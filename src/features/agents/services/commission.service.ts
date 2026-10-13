import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import {
  DEFAULT_RETURN_PERIOD_DAYS,
  RETURN_PERIOD_SETTING_KEY,
  SYSTEM_ACTOR,
  type AuditActor,
} from "../constants";
import { writeAudit } from "./commission-audit";
import { calculateCommissionAmount, resolveCommissionRate } from "./commission-rate.service";
import { buildCommissionWhere, formatCommissionRow, commissionInclude } from "./commission.queries";
import type { CommissionFilters } from "../types";

type Client = Prisma.TransactionClient | typeof db;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getReturnPeriodDays(client: Client = db): Promise<number> {
  const setting = await client.settings.findUnique({ where: { key_name: RETURN_PERIOD_SETTING_KEY } });
  const days = Number(setting?.value);
  return Number.isFinite(days) && days >= 0 ? days : DEFAULT_RETURN_PERIOD_DAYS;
}

/**
 * Creates one commission per order item for an agent-attributed order. Runs
 * inside the order-creation transaction. Percentage and amount are frozen
 * here; later rate changes never touch existing rows. The UNIQUE index on
 * order_item_id (plus the existence check) prevents duplicates.
 *
 * The commissionable amount is the item's own line total (after item-level
 * offers) - shipping lives on the order, never on items, so it is excluded.
 */
export async function createCommissionsForOrder(tx: Prisma.TransactionClient, orderId: bigint) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      agent_id: true,
      referral_code: true,
      order_source: true,
      order_status: true,
      items: {
        where: { is_active: true },
        select: {
          id: true,
          productId: true,
          total_price: true,
          product: { select: { categoryId: true } },
        },
      },
    },
  });
  if (!order || !order.agent_id) return [];
  // A plain customer-direct order bought by the agent themselves never earns; own and agent-placed
  // (incl. walk-in) orders are explicit sources and do.
  if (order.agent_id === order.userId && order.order_source === "CUSTOMER_DIRECT") return [];

  const existing = await tx.commissions.findMany({
    where: { order_id: orderId },
    select: { order_item_id: true },
  });
  const seen = new Set(existing.map((c) => c.order_item_id));

  const created: bigint[] = [];
  let totalBase = 0;
  let totalCommission = 0;
  for (const item of order.items) {
    if (seen.has(item.id)) continue;

    const productAmount = Number(item.total_price);
    const categoryId = item.product.categoryId != null ? BigInt(item.product.categoryId) : null;
    const rate = await resolveCommissionRate(tx, item.productId, categoryId);
    if (rate.percentage <= 0 || productAmount <= 0) continue;

    const amount = calculateCommissionAmount(productAmount, rate.percentage);
    const commission = await tx.commissions.create({
      data: {
        uuid: crypto.randomUUID(),
        agent_id: order.agent_id,
        referral_code: order.referral_code,
        customer_id: order.userId,
        order_id: order.id,
        order_item_id: item.id,
        product_id: item.productId,
        category_id: categoryId,
        product_amount: productAmount,
        commission_percentage: rate.percentage,
        rate_source: rate.source,
        commission_amount: amount,
        status: "pending",
        order_status: order.order_status,
      },
    });
    created.push(commission.id);
    totalBase += productAmount;
    totalCommission += amount;
    await writeAudit(tx, {
      entityType: "commission",
      entityId: commission.id,
      agentId: order.agent_id,
      action: "commission_created",
      toStatus: "pending",
      actor: SYSTEM_ACTOR,
      metadata: {
        orderId: String(order.id),
        productAmount,
        percentage: rate.percentage,
        source: rate.source,
        amount,
      },
    });
  }
  // Freeze the order-level summary (blended % over the commissionable amount) on the order itself.
  if (created.length > 0) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        commission_amount: Math.round(totalCommission * 100) / 100,
        commission_percentage: totalBase > 0 ? Math.round((totalCommission * 10000) / totalBase) / 100 : 0,
      },
    });
  }
  return created;
}

interface VoidParams {
  orderId: bigint;
  /** Limit to specific order items (partial return); omit to void the whole order. */
  orderItemIds?: bigint[];
  kind: "cancelled" | "returned";
  reason: string;
  actor: AuditActor;
}

/**
 * Cancels/reverses commissions for a cancelled or returned order (or items).
 *  - cancelled order, not yet approved  -> `cancelled`
 *  - returned, or already approved      -> `reversed`
 * A reversed commission that sits in an unpaid payout is pulled out of it and
 * the payout total is recalculated; one that was already paid is flagged
 * `clawback_due` so finance can recover it. Nothing is deleted.
 */
export async function voidCommissions(tx: Prisma.TransactionClient, params: VoidParams) {
  const rows = await tx.commissions.findMany({
    where: {
      order_id: params.orderId,
      status: { notIn: ["cancelled", "reversed"] },
      ...(params.orderItemIds ? { order_item_id: { in: params.orderItemIds } } : {}),
    },
  });
  if (rows.length === 0) return 0;

  const now = new Date();
  const touchedPayouts = new Set<bigint>();

  for (const row of rows) {
    const cancelOnly = params.kind === "cancelled" && (row.status === "pending" || row.status === "pending_approval");
    const toStatus = cancelOnly ? "cancelled" : "reversed";
    const inOpenPayout = row.status === "payout_requested" || row.status === "payout_approved";
    const wasPaid = row.status === "paid";

    await tx.commissions.update({
      where: { id: row.id },
      data: {
        status: toStatus,
        cancelled_at: cancelOnly ? now : row.cancelled_at,
        reversed_at: cancelOnly ? row.reversed_at : now,
        reversal_reason: params.reason.slice(0, 255),
        clawback_due: wasPaid,
        payout_id: inOpenPayout ? null : row.payout_id,
      },
    });
    if (inOpenPayout && row.payout_id) touchedPayouts.add(row.payout_id);

    await writeAudit(tx, {
      entityType: "commission",
      entityId: row.id,
      agentId: row.agent_id,
      action: cancelOnly ? "commission_cancelled" : "commission_reversed",
      fromStatus: row.status,
      toStatus,
      actor: params.actor,
      note: params.reason,
      metadata: {
        amount: Number(row.commission_amount),
        clawbackDue: wasPaid,
        payoutId: row.payout_id ? String(row.payout_id) : null,
      },
    });
  }

  for (const payoutId of touchedPayouts) {
    const payout = await tx.commission_payouts.findUnique({
      where: { id: payoutId },
      include: { commissions: { select: { commission_amount: true } } },
    });
    if (!payout) continue;
    const remaining =
      payout.commissions.reduce((sum, c) => sum + Math.round(Number(c.commission_amount) * 100), 0) / 100;
    const cancelled = remaining <= 0;
    await tx.commission_payouts.update({
      where: { id: payoutId },
      data: {
        amount: remaining,
        ...(cancelled
          ? { status: "cancelled", admin_note: "All commissions in this payout were reversed" }
          : {}),
      },
    });
    await writeAudit(tx, {
      entityType: "payout",
      entityId: payoutId,
      agentId: payout.agent_id,
      action: cancelled ? "payout_cancelled_after_reversal" : "payout_amount_adjusted",
      fromStatus: payout.status,
      toStatus: cancelled ? "cancelled" : payout.status,
      actor: params.actor,
      note: "Commission reversed after order was returned/cancelled",
      metadata: { previousAmount: Number(payout.amount), newAmount: remaining },
    });
  }
  return rows.length;
}

/**
 * Called from every code path that changes an order's status, inside that
 * path's transaction, so commission state can never drift from order state.
 */
export async function syncCommissionsWithOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: bigint,
  status: string,
  actor: AuditActor
) {
  await tx.commissions.updateMany({ where: { order_id: orderId }, data: { order_status: status } });

  if (status === "delivered") {
    const days = await getReturnPeriodDays(tx);
    const now = new Date();
    const endsAt = new Date(now.getTime() + days * DAY_MS);
    const rows = await tx.commissions.findMany({
      where: { order_id: orderId, status: "pending", delivered_at: null },
      select: { id: true, agent_id: true },
    });
    for (const row of rows) {
      await tx.commissions.update({
        where: { id: row.id },
        data: { delivered_at: now, return_period_ends_at: endsAt },
      });
      await writeAudit(tx, {
        entityType: "commission",
        entityId: row.id,
        agentId: row.agent_id,
        action: "return_period_started",
        fromStatus: "pending",
        toStatus: "pending",
        actor,
        metadata: { returnPeriodDays: days, returnPeriodEndsAt: endsAt.toISOString() },
      });
    }
  } else if (status === "cancelled") {
    await voidCommissions(tx, { orderId, kind: "cancelled", reason: "Order cancelled", actor });
  } else if (status === "returned") {
    await voidCommissions(tx, { orderId, kind: "returned", reason: "Order returned", actor });
  }
}

export const commissionService = {
  /**
   * Moves commissions whose return period has ended from `pending` to `pending_approval`.
   * They are NOT payable yet - an admin must approve them (see `approve`). There is no scheduler
   * in this app, so this runs lazily whenever commissions are read/requested.
   */
  async markReadyForApproval(opts: { agentId?: bigint; actor?: AuditActor } = {}): Promise<number> {
    const actor = opts.actor ?? SYSTEM_ACTOR;
    const due = await db.commissions.findMany({
      where: {
        status: "pending",
        delivered_at: { not: null },
        return_period_ends_at: { lte: new Date() },
        ...(opts.agentId ? { agent_id: opts.agentId } : {}),
      },
      select: { id: true, agent_id: true },
      take: 500,
    });

    if (due.length === 0) return 0;

    // One transaction for the whole batch; re-check status inside so a concurrent sweep can't double-audit.
    return db.$transaction(async (tx) => {
      const still = await tx.commissions.findMany({
        where: { id: { in: due.map((r) => r.id) }, status: "pending" },
        select: { id: true, agent_id: true },
      });
      if (still.length === 0) return 0;
      await tx.commissions.updateMany({
        where: { id: { in: still.map((r) => r.id) }, status: "pending" },
        data: { status: "pending_approval" },
      });
      for (const row of still) {
        await writeAudit(tx, {
          entityType: "commission",
          entityId: row.id,
          agentId: row.agent_id,
          action: "commission_ready_for_approval",
          fromStatus: "pending",
          toStatus: "pending_approval",
          actor,
          note: "Return period completed",
        });
      }
      return still.length;
    });
  },

  /**
   * Admin approval: `pending_approval` -> `approved` (now withdrawable). `ids` = commission uuids;
   * omit to approve everything awaiting approval. The conditional update means a commission that was
   * returned/cancelled in the meantime is never approved.
   */
  async approve(opts: { ids?: string[]; actor: AuditActor }): Promise<number> {
    if (opts.actor.role !== "ADMIN" || !opts.actor.id) throw ApiError.forbidden("Only an admin can approve commissions");
    await this.markReadyForApproval({ actor: opts.actor });

    const rows = await db.commissions.findMany({
      where: { status: "pending_approval", ...(opts.ids?.length ? { uuid: { in: opts.ids } } : {}) },
      select: { id: true, agent_id: true },
      take: 500,
    });

    let approved = 0;
    for (const row of rows) {
      await db.$transaction(async (tx) => {
        const res = await tx.commissions.updateMany({
          where: { id: row.id, status: "pending_approval" },
          data: { status: "approved", approved_at: new Date() },
        });
        if (res.count === 0) return;
        approved += 1;
        await writeAudit(tx, {
          entityType: "commission",
          entityId: row.id,
          agentId: row.agent_id,
          action: "commission_approved",
          fromStatus: "pending_approval",
          toStatus: "approved",
          actor: opts.actor,
          note: "Approved by admin",
        });
      });
    }
    return approved;
  },

  async list(filters: CommissionFilters, scope: { agentId?: bigint } = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where = await buildCommissionWhere(filters, scope);

    const [rows, total] = await Promise.all([
      db.commissions.findMany({
        where,
        include: commissionInclude,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.commissions.count({ where }),
    ]);

    return {
      data: rows.map(formatCommissionRow),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async getAuditTrail(entityType: string, entityId: bigint) {
    return db.commission_audit_logs.findMany({
      where: { entity_type: entityType, entity_id: entityId },
      orderBy: { created_at: "asc" },
    });
  },
};
