import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { decryptField, maskAccountNumber } from "@/lib/security/field-crypto";
import type { AuditActor } from "../constants";
import { writeAudit } from "./commission-audit";
import { commissionService } from "./commission.service";
import { endOfDay, padCode, resolveAgentRef, startOfDay } from "./commission.queries";
import type { PaginatedResult, PayoutRow } from "../types";
import type { RequestPayoutInput } from "../validations/agent.schema";

const payoutInclude = {
  agent: { select: { uuid: true, name: true, agent_profile: { select: { agent_code: true } } } },
  _count: { select: { commissions: true } },
} satisfies Prisma.commission_payoutsInclude;

type PayoutWithRelations = Prisma.commission_payoutsGetPayload<{ include: typeof payoutInclude }>;

function formatPayout(p: PayoutWithRelations): PayoutRow {
  const destination =
    p.method === "upi"
      ? (p.upi_id ?? "")
      : [p.bank_name, maskAccountNumber(p.account_last4)].filter(Boolean).join(" · ");
  return {
    id: p.uuid,
    code: padCode("PAY", p.id),
    agentId: p.agent.uuid ?? String(p.agent_id),
    agentName: p.agent.name,
    agentCode: p.agent.agent_profile?.agent_code ?? null,
    amount: Number(p.amount),
    method: p.method,
    destination,
    bankName: p.bank_name,
    accountHolderName: p.account_holder_name,
    ifsc: p.ifsc,
    status: p.status,
    requestedAt: p.requested_at.toISOString(),
    reviewedAt: p.reviewed_at?.toISOString() ?? null,
    paidAt: p.paid_at?.toISOString() ?? null,
    transactionReference: p.transaction_reference,
    rejectionReason: p.rejection_reason,
    adminNote: p.admin_note,
    commissionCount: p._count.commissions,
  };
}

async function findPayoutByRef(ref: string) {
  const payout = await db.commission_payouts.findFirst({
    where: { OR: [{ uuid: ref }, ...(/^\d+$/.test(ref) ? [{ id: BigInt(ref) }] : [])] },
  });
  if (!payout) throw ApiError.notFound("Payout request not found");
  return payout;
}

/** Bulk-writes one audit row per commission moved by a payout transition. */
async function auditCommissionMoves(
  tx: Prisma.TransactionClient,
  commissions: { id: bigint; agent_id: bigint }[],
  action: string,
  from: string,
  to: string,
  actor: AuditActor,
  payoutId: bigint,
  note?: string | null
) {
  if (commissions.length === 0) return;
  await tx.commission_audit_logs.createMany({
    data: commissions.map((c) => ({
      entity_type: "commission",
      entity_id: c.id,
      agent_id: c.agent_id,
      action,
      from_status: from,
      to_status: to,
      actor_id: actor.id,
      actor_role: actor.role,
      note: note ?? null,
      metadata: { payoutId: String(payoutId) },
    })),
  });
}

export const payoutService = {
  /** Commissions the agent could request a payout for right now. */
  async availableBalance(agentId: bigint, opts: { skipSweep?: boolean } = {}) {
    if (!opts.skipSweep) await commissionService.markReadyForApproval({ agentId });
    const agg = await db.commissions.aggregate({
      where: { agent_id: agentId, status: "approved", payout_id: null },
      _sum: { commission_amount: true },
      _count: { _all: true },
    });
    return { amount: Number(agg._sum.commission_amount ?? 0), count: agg._count._all };
  },

  /**
   * Agent requests a payout of every approved, not-yet-requested commission.
   * Payment details are read from the agent's saved profile and snapshotted
   * onto the payout, so nothing sensitive travels in the request itself.
   */
  async requestPayout(agentId: bigint, input: RequestPayoutInput) {
    await commissionService.markReadyForApproval({ agentId });

    const profile = await db.agent_profiles.findUnique({ where: { user_id: agentId } });
    if (!profile) throw ApiError.badRequest("Your Sales Partner profile is incomplete. Please contact support.");

    if (input.method === "upi" && !profile.upi_id) {
      throw ApiError.badRequest("Add your UPI ID in Profile & Payment Details first");
    }
    if (
      input.method === "bank_transfer" &&
      !(profile.bank_account_number_enc && profile.bank_account_holder && profile.bank_name && profile.bank_ifsc)
    ) {
      throw ApiError.badRequest("Add your bank details in Profile & Payment Details first");
    }

    const payoutId = await db.$transaction(async (tx) => {
      const eligible = await tx.commissions.findMany({
        where: { agent_id: agentId, status: "approved", payout_id: null },
        select: { id: true, agent_id: true, commission_amount: true },
      });
      const cents = eligible.reduce((sum, c) => sum + Math.round(Number(c.commission_amount) * 100), 0);
      if (eligible.length === 0 || cents <= 0) {
        throw ApiError.badRequest("You have no approved commission available for payout");
      }
      const amount = cents / 100;

      const payout = await tx.commission_payouts.create({
        data: {
          uuid: crypto.randomUUID(),
          agent_id: agentId,
          amount,
          method: input.method,
          upi_id: input.method === "upi" ? profile.upi_id : null,
          account_holder_name: input.method === "bank_transfer" ? profile.bank_account_holder : null,
          bank_name: input.method === "bank_transfer" ? profile.bank_name : null,
          account_number_enc: input.method === "bank_transfer" ? profile.bank_account_number_enc : null,
          account_last4: input.method === "bank_transfer" ? profile.bank_account_last4 : null,
          ifsc: input.method === "bank_transfer" ? profile.bank_ifsc : null,
          status: "requested",
        },
      });

      // Conditional update: if any commission was reversed/claimed since the read above, bail out.
      const moved = await tx.commissions.updateMany({
        where: { id: { in: eligible.map((c) => c.id) }, status: "approved", payout_id: null },
        data: { status: "payout_requested", payout_id: payout.id },
      });
      if (moved.count !== eligible.length) {
        throw ApiError.conflict("Your commissions changed while requesting. Please try again.");
      }

      const actor: AuditActor = { id: agentId, role: "AGENT" };
      await writeAudit(tx, {
        entityType: "payout",
        entityId: payout.id,
        agentId,
        action: "payout_requested",
        toStatus: "requested",
        actor,
        metadata: { amount, method: input.method, commissionCount: eligible.length },
      });
      await auditCommissionMoves(tx, eligible, "payout_requested", "approved", "payout_requested", actor, payout.id);
      return payout.id;
    });

    return this.getPayout(String(payoutId));
  },

  async approve(payoutRef: string, actor: AuditActor, note?: string) {
    const payout = await findPayoutByRef(payoutRef);
    await db.$transaction(async (tx) => {
      const res = await tx.commission_payouts.updateMany({
        where: { id: payout.id, status: "requested" },
        data: { status: "approved", reviewed_at: new Date(), reviewed_by: actor.id, admin_note: note ?? null },
      });
      if (res.count === 0) throw ApiError.badRequest(`Payout is '${payout.status}' and cannot be approved`);

      const rows = await tx.commissions.findMany({
        where: { payout_id: payout.id, status: "payout_requested" },
        select: { id: true, agent_id: true },
      });
      await tx.commissions.updateMany({
        where: { id: { in: rows.map((r) => r.id) }, status: "payout_requested" },
        data: { status: "payout_approved" },
      });
      await writeAudit(tx, {
        entityType: "payout",
        entityId: payout.id,
        agentId: payout.agent_id,
        action: "payout_approved",
        fromStatus: "requested",
        toStatus: "approved",
        actor,
        note,
      });
      await auditCommissionMoves(tx, rows, "payout_approved", "payout_requested", "payout_approved", actor, payout.id);
    });
    return this.getPayout(String(payout.id));
  },

  /** Rejecting frees the commissions so the agent can request again. */
  async reject(payoutRef: string, reason: string, actor: AuditActor) {
    const payout = await findPayoutByRef(payoutRef);
    await db.$transaction(async (tx) => {
      const res = await tx.commission_payouts.updateMany({
        where: { id: payout.id, status: { in: ["requested", "approved"] } },
        data: { status: "rejected", reviewed_at: new Date(), reviewed_by: actor.id, rejection_reason: reason },
      });
      if (res.count === 0) throw ApiError.badRequest(`Payout is '${payout.status}' and cannot be rejected`);

      const rows = await tx.commissions.findMany({
        where: { payout_id: payout.id, status: { in: ["payout_requested", "payout_approved"] } },
        select: { id: true, agent_id: true, status: true },
      });
      await tx.commissions.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { status: "approved", payout_id: null },
      });
      await writeAudit(tx, {
        entityType: "payout",
        entityId: payout.id,
        agentId: payout.agent_id,
        action: "payout_rejected",
        fromStatus: payout.status,
        toStatus: "rejected",
        actor,
        note: reason,
      });
      await auditCommissionMoves(tx, rows, "payout_rejected", "payout_requested", "approved", actor, payout.id, reason);
    });
    return this.getPayout(String(payout.id));
  },

  async markPaid(payoutRef: string, input: { transactionReference: string; note?: string }, actor: AuditActor) {
    const payout = await findPayoutByRef(payoutRef);
    await db.$transaction(async (tx) => {
      const now = new Date();
      const res = await tx.commission_payouts.updateMany({
        where: { id: payout.id, status: "approved" },
        data: {
          status: "paid",
          paid_at: now,
          paid_by: actor.id,
          transaction_reference: input.transactionReference,
          admin_note: input.note ?? payout.admin_note,
        },
      });
      if (res.count === 0) {
        throw ApiError.badRequest(`Payout is '${payout.status}'. Only approved payouts can be marked as paid.`);
      }

      const rows = await tx.commissions.findMany({
        where: { payout_id: payout.id, status: "payout_approved" },
        select: { id: true, agent_id: true },
      });
      await tx.commissions.updateMany({
        where: { id: { in: rows.map((r) => r.id) }, status: "payout_approved" },
        data: { status: "paid", paid_at: now },
      });
      await writeAudit(tx, {
        entityType: "payout",
        entityId: payout.id,
        agentId: payout.agent_id,
        action: "payout_paid",
        fromStatus: "approved",
        toStatus: "paid",
        actor,
        note: input.note,
        metadata: { transactionReference: input.transactionReference, amount: Number(payout.amount) },
      });
      await auditCommissionMoves(tx, rows, "commission_paid", "payout_approved", "paid", actor, payout.id);
    });
    return this.getPayout(String(payout.id));
  },

  async getPayout(ref: string, scope: { agentId?: bigint } = {}) {
    const payout = await db.commission_payouts.findFirst({
      where: {
        OR: [{ uuid: ref }, ...(/^\d+$/.test(ref) ? [{ id: BigInt(ref) }] : [])],
        ...(scope.agentId ? { agent_id: scope.agentId } : {}),
      },
      include: payoutInclude,
    });
    if (!payout) throw ApiError.notFound("Payout request not found");
    return formatPayout(payout);
  },

  /**
   * Full destination for the person actually sending the money. Only admins
   * reach this, the account number is decrypted only here, and each reveal
   * is written to the audit trail.
   */
  async revealDestination(payoutRef: string, actor: AuditActor) {
    const payout = await findPayoutByRef(payoutRef);
    await writeAudit(db, {
      entityType: "payout",
      entityId: payout.id,
      agentId: payout.agent_id,
      action: "payout_details_viewed",
      actor,
    });
    return {
      method: payout.method,
      upiId: payout.upi_id,
      accountHolderName: payout.account_holder_name,
      bankName: payout.bank_name,
      accountNumber: payout.account_number_enc ? decryptField(payout.account_number_enc) : null,
      ifsc: payout.ifsc,
    };
  },

  async list(
    filters: { agent?: string; status?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number },
    scope: { agentId?: bigint } = {}
  ): Promise<PaginatedResult<PayoutRow>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.commission_payoutsWhereInput = {};

    if (scope.agentId) {
      where.agent_id = scope.agentId;
    } else if (filters.agent) {
      where.agent_id = (await resolveAgentRef(filters.agent)) ?? BigInt(0);
    }
    if (filters.status && ["requested", "approved", "rejected", "paid", "cancelled"].includes(filters.status)) {
      where.status = filters.status as Prisma.commission_payoutsWhereInput["status"];
    }
    const from = filters.dateFrom ? startOfDay(filters.dateFrom) : null;
    const to = filters.dateTo ? endOfDay(filters.dateTo) : null;
    if (from || to) where.requested_at = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

    const [rows, total] = await Promise.all([
      db.commission_payouts.findMany({
        where,
        include: payoutInclude,
        orderBy: { requested_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.commission_payouts.count({ where }),
    ]);
    return {
      data: rows.map(formatPayout),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },
};
