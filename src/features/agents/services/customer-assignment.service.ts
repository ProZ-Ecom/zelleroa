import crypto from "crypto";
import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { writeAudit } from "./commission-audit";
import { resolveAgentRef } from "./commission.queries";
import { findAgentByReferralCode, type ReferralAgent } from "./referral.service";
import type { AuditActor } from "../constants";

type Client = Prisma.TransactionClient | typeof db;

/** Resolves a customer reference (uuid, cust_id or numeric id) to a customer-role user. */
async function resolveCustomer(ref: string, client: Client = db) {
  const customer = await client.user.findFirst({
    where: {
      deleted_at: null,
      role: { slug: "customer" },
      OR: [{ uuid: ref }, { cust_id: ref }, ...(/^\d+$/.test(ref) ? [{ id: BigInt(ref) }] : [])],
    },
    select: { id: true, uuid: true, name: true, current_agent_id: true },
  });
  return customer;
}

export const customerAssignmentService = {
  /**
   * Referral-code assignment. Only ever fills an EMPTY slot: a customer who already has an
   * agent keeps them (moving between agents is an admin-only transfer). The conditional
   * `updateMany` makes two concurrent attempts safe - exactly one wins.
   * Returns the agent id now responsible for the customer (or null).
   */
  async assignFromReferral(customerId: bigint, agentId: bigint, client: Client = db): Promise<bigint | null> {
    if (customerId === agentId) return null;

    const customer = await client.user.findUnique({
      where: { id: customerId },
      select: { current_agent_id: true, role: { select: { slug: true } } },
    });
    if (!customer || customer.role.slug !== "customer") return customer?.current_agent_id ?? null;
    if (customer.current_agent_id) return customer.current_agent_id;

    const run = async (tx: Prisma.TransactionClient) => {
      const res = await tx.user.updateMany({
        where: { id: customerId, current_agent_id: null },
        data: { current_agent_id: agentId, agent_assigned_at: new Date() },
      });
      if (res.count === 0) {
        const again = await tx.user.findUnique({ where: { id: customerId }, select: { current_agent_id: true } });
        return again?.current_agent_id ?? null;
      }
      await tx.customer_agent_history.create({
        data: {
          uuid: crypto.randomUUID(),
          customer_id: customerId,
          from_agent_id: null,
          to_agent_id: agentId,
          action: "assigned",
          transferred_by: null,
          reason: "Referral code",
        },
      });
      await writeAudit(tx, {
        entityType: "assignment",
        entityId: customerId,
        agentId,
        action: "customer_assigned",
        actor: { id: null, role: "SYSTEM" },
        metadata: { via: "referral" },
      });
      return agentId;
    };
    return "$transaction" in client ? (client as typeof db).$transaction(run) : run(client as Prisma.TransactionClient);
  },

  /**
   * Who an order placed by `buyerId` belongs to, decided once at creation and frozen on the order.
   *  - agent buying for themselves        -> AGENT_OWN, credited to that agent
   *  - customer with a current agent       -> CUSTOMER_DIRECT, credited to that agent (a different
   *    referral code never changes it; only an empty slot is filled from the visitor's code)
   *  - anyone else                         -> CUSTOMER_DIRECT, no agent
   * An inactive agent is not credited.
   */
  async resolveOrderAttribution(buyerId: bigint, referral: ReferralAgent | null, client: Client = db) {
    const buyer = await client.user.findUnique({
      where: { id: buyerId },
      select: {
        referral_code: true,
        current_agent_id: true,
        role: { select: { slug: true } },
        agent_profile: { select: { agent_code: true } },
      },
    });
    const none = { orderSource: "CUSTOMER_DIRECT" as const, agentId: null, referralCode: null, orderedById: buyerId };
    if (!buyer) return none;

    if (buyer.role.slug === "agent") {
      return {
        orderSource: "AGENT_OWN" as const,
        agentId: buyerId,
        referralCode: buyer.referral_code ?? buyer.agent_profile?.agent_code ?? null,
        orderedById: buyerId,
      };
    }
    if (buyer.role.slug !== "customer") return none;

    let agentId = buyer.current_agent_id;
    if (!agentId && referral) agentId = await this.assignFromReferral(buyerId, referral.id, client);
    if (!agentId) return none;

    const agent = await client.user.findFirst({
      where: { id: agentId, is_active: true, status: "active", deleted_at: null, role: { slug: "agent" } },
      select: { referral_code: true, agent_profile: { select: { agent_code: true } } },
    });
    if (!agent) return none;
    return {
      orderSource: "CUSTOMER_DIRECT" as const,
      agentId,
      referralCode: agent.referral_code ?? agent.agent_profile?.agent_code ?? null,
      orderedById: buyerId,
    };
  },

  /** Convenience for sign-up / login / checkout: validate a raw referral code, then assign. */
  async assignFromReferralCode(customerId: bigint, code: string | null | undefined, client: Client = db) {
    const agent = await findAgentByReferralCode(code, client);
    if (!agent) return null;
    return this.assignFromReferral(customerId, agent.id, client);
  },

  /**
   * Admin-only. Moves ONE customer to another agent and records who/when. Old orders and
   * commissions are not touched - they keep the agent they were created for. The write is
   * conditional on the agent the admin saw (`fromAgentRef`), so a stale screen cannot clobber a
   * newer transfer.
   */
  async transferCustomer(
    input: { customerRef: string; toAgentRef: string; fromAgentRef?: string | null; reason?: string | null },
    actor: AuditActor
  ) {
    if (actor.role !== "ADMIN" || !actor.id) throw ApiError.forbidden("Only an admin can transfer customers");

    const customer = await resolveCustomer(input.customerRef);
    if (!customer) throw ApiError.notFound("Customer not found");

    const toAgentId = await resolveAgentRef(input.toAgentRef);
    if (!toAgentId) throw ApiError.badRequest("Destination Sales Partner not found");
    const toAgent = await db.user.findUnique({
      where: { id: toAgentId },
      select: { name: true, is_active: true, status: true, deleted_at: true },
    });
    if (!toAgent || toAgent.deleted_at || !toAgent.is_active || toAgent.status !== "active") {
      throw ApiError.badRequest("Destination Sales Partner is not active");
    }

    const fromAgentId = customer.current_agent_id;
    if (input.fromAgentRef) {
      const expected = await resolveAgentRef(input.fromAgentRef);
      if (expected !== fromAgentId) {
        throw ApiError.conflict("This customer's Sales Partner has changed. Refresh and try again.");
      }
    }
    if (fromAgentId === toAgentId) throw ApiError.badRequest("Customer is already assigned to this Sales Partner");

    await db.$transaction(async (tx) => {
      const res = await tx.user.updateMany({
        where: { id: customer.id, current_agent_id: fromAgentId },
        data: { current_agent_id: toAgentId, agent_assigned_at: new Date(), updated_by: actor.id },
      });
      if (res.count !== 1) throw ApiError.conflict("This customer was just updated by someone else. Refresh and try again.");
      await tx.customer_agent_history.create({
        data: {
          uuid: crypto.randomUUID(),
          customer_id: customer.id,
          from_agent_id: fromAgentId,
          to_agent_id: toAgentId,
          action: fromAgentId ? "transferred" : "assigned",
          transferred_by: actor.id,
          reason: input.reason?.trim().slice(0, 255) || null,
        },
      });
      await writeAudit(tx, {
        entityType: "assignment",
        entityId: customer.id,
        agentId: toAgentId,
        action: "customer_transferred",
        actor,
        note: input.reason?.trim().slice(0, 255) || undefined,
        metadata: {
          fromAgentId: fromAgentId ? String(fromAgentId) : null,
          toAgentId: String(toAgentId),
        },
      });
    });
    return { customerId: customer.uuid ?? String(customer.id), toAgentName: toAgent.name };
  },

  /**
   * Admin-only bulk move of customers OFF one agent (typically a blocked one) onto another. Each
   * customer goes through `transferCustomer`, so every rule and history row still applies; one
   * failure never stops the rest. `customerRefs` omitted = every customer the agent still has.
   */
  async reassignFromAgent(
    input: { fromAgentRef: string; toAgentRef: string; customerRefs?: string[]; reason?: string | null },
    actor: AuditActor
  ) {
    if (actor.role !== "ADMIN" || !actor.id) throw ApiError.forbidden("Only an admin can transfer customers");
    const fromId = await resolveAgentRef(input.fromAgentRef);
    if (!fromId) throw ApiError.notFound("Sales Partner not found");

    let refs = input.customerRefs;
    if (!refs?.length) {
      const rows = await db.user.findMany({
        where: { current_agent_id: fromId, deleted_at: null, role: { slug: "customer" } },
        select: { uuid: true, id: true },
        take: 500,
      });
      refs = rows.map((r) => r.uuid ?? String(r.id));
    }

    let moved = 0;
    const failed: { customerId: string; message: string }[] = [];
    for (const ref of refs) {
      try {
        await this.transferCustomer(
          { customerRef: ref, toAgentRef: input.toAgentRef, fromAgentRef: input.fromAgentRef, reason: input.reason },
          actor
        );
        moved += 1;
      } catch (err) {
        failed.push({ customerId: ref, message: err instanceof Error ? err.message : "Transfer failed" });
      }
    }
    return { moved, failed };
  },

  /** The customer's current Sales Partner (or null) - what the admin transfer card shows. */
  async getCurrentAgent(customerRef: string) {
    const customer = await db.user.findFirst({
      where: {
        deleted_at: null,
        role: { slug: "customer" },
        OR: [{ uuid: customerRef }, { cust_id: customerRef }, ...(/^\d+$/.test(customerRef) ? [{ id: BigInt(customerRef) }] : [])],
      },
      select: {
        agent_assigned_at: true,
        current_agent: { select: { uuid: true, name: true, agent_profile: { select: { agent_code: true } } } },
      },
    });
    if (!customer) throw ApiError.notFound("Customer not found");
    const a = customer.current_agent;
    return {
      agent: a ? { id: a.uuid ?? "", name: a.name, agentCode: a.agent_profile?.agent_code ?? null } : null,
      assignedAt: customer.agent_assigned_at?.toISOString() ?? null,
    };
  },

  /** Full, never-pruned transfer history. Admin: any/all customers. */
  async listHistory(filters: { customerRef?: string; agentRef?: string; page?: number; limit?: number }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.customer_agent_historyWhereInput = {};
    if (filters.customerRef) {
      const c = await resolveCustomer(filters.customerRef);
      where.customer_id = c?.id ?? BigInt(0);
    }
    if (filters.agentRef) {
      const a = await resolveAgentRef(filters.agentRef);
      where.OR = [{ from_agent_id: a ?? BigInt(0) }, { to_agent_id: a ?? BigInt(0) }];
    }
    const [rows, total] = await Promise.all([
      db.customer_agent_history.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          uuid: true,
          action: true,
          reason: true,
          created_at: true,
          customer: { select: { uuid: true, name: true, cust_id: true } },
          from_agent: { select: { name: true, agent_profile: { select: { agent_code: true } } } },
          to_agent: { select: { name: true, agent_profile: { select: { agent_code: true } } } },
          actor: { select: { name: true } },
        },
      }),
      db.customer_agent_history.count({ where }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.uuid,
        action: r.action,
        customerId: r.customer.uuid ?? "",
        customerName: r.customer.name,
        fromAgentName: r.from_agent?.name ?? null,
        fromAgentCode: r.from_agent?.agent_profile?.agent_code ?? null,
        toAgentName: r.to_agent.name,
        toAgentCode: r.to_agent.agent_profile?.agent_code ?? null,
        transferredBy: r.actor?.name ?? (r.action === "assigned" ? "Referral (automatic)" : "System"),
        reason: r.reason,
        at: r.created_at.toISOString(),
      })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },
};

/** The assigned customer of THIS agent, or null. Every agent-facing customer lookup goes through here. */
export async function findAssignedCustomer(agentId: bigint, customerRef: string, client: Client = db) {
  return client.user.findFirst({
    where: {
      current_agent_id: agentId,
      deleted_at: null,
      role: { slug: "customer" },
      OR: [{ uuid: customerRef }, { cust_id: customerRef }, ...(/^\d+$/.test(customerRef) ? [{ id: BigInt(customerRef) }] : [])],
    },
    select: { id: true, uuid: true, name: true, email: true, phone: true, is_active: true, status: true },
  });
}
