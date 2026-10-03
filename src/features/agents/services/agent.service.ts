import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { APP_URL } from "@/lib/constants";
import { encryptField, maskAccountNumber } from "@/lib/security/field-crypto";
import { writeAudit } from "./commission-audit";
import { customerSearchWhere, endOfDay, resolveAgentRef, startOfDay } from "./commission.queries";
import type { AuditActor } from "../constants";
import type { AgentSummary, PaginatedResult } from "../types";
import type { CreateAgentInput, PaymentDetailsInput, UpdateAgentInput } from "../validations/agent.schema";

const DEAD_ORDER_STATUSES = ["cancelled", "returned"] as const;

export function buildReferralLink(code: string) {
  return `${APP_URL}/?ref=${encodeURIComponent(code)}`;
}

function emptySummary(): AgentSummary {
  return {
    totalReferredCustomers: 0,
    totalOrders: 0,
    totalSales: 0,
    pendingCommission: 0,
    approvedCommission: 0,
    paidCommission: 0,
    totalCommission: 0,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Aggregated counters for a set of agents in 3 grouped queries (no per-agent loops). */
async function summariesFor(agentIds: bigint[]): Promise<Map<string, AgentSummary & { openPayouts: number }>> {
  const result = new Map<string, AgentSummary & { openPayouts: number }>();
  if (agentIds.length === 0) return result;
  for (const id of agentIds) result.set(String(id), { ...emptySummary(), openPayouts: 0 });

  const [customers, orders, commissions, payouts] = await Promise.all([
    // "Customers" = distinct customers who have placed an order under this agent's code.
    // There is no permanent customer-agent link; the same customer can appear under several agents.
    db.order.groupBy({
      by: ["agent_id", "userId"],
      where: { agent_id: { in: agentIds }, is_active: true },
    }),
    db.order.groupBy({
      by: ["agent_id"],
      where: {
        agent_id: { in: agentIds },
        is_active: true,
        order_status: { notIn: [...DEAD_ORDER_STATUSES] },
      },
      _count: { _all: true },
      _sum: { subtotal: true },
    }),
    db.commissions.groupBy({
      by: ["agent_id", "status"],
      where: { agent_id: { in: agentIds } },
      _sum: { commission_amount: true },
    }),
    db.commission_payouts.groupBy({
      by: ["agent_id"],
      where: { agent_id: { in: agentIds }, status: { in: ["requested", "approved"] } },
      _count: { _all: true },
    }),
  ]);

  for (const row of customers) result.get(String(row.agent_id))!.totalReferredCustomers += 1;
  for (const row of orders) {
    const s = result.get(String(row.agent_id));
    if (!s) continue;
    s.totalOrders = row._count._all;
    s.totalSales = round2(Number(row._sum.subtotal ?? 0));
  }
  for (const row of commissions) {
    const s = result.get(String(row.agent_id))!;
    const amount = Number(row._sum.commission_amount ?? 0);
    if (row.status === "pending") s.pendingCommission += amount;
    else if (row.status === "paid") s.paidCommission += amount;
    else if (["approved", "payout_requested", "payout_approved"].includes(row.status)) s.approvedCommission += amount;
  }
  for (const row of payouts) result.get(String(row.agent_id))!.openPayouts = row._count._all;

  for (const s of result.values()) {
    s.pendingCommission = round2(s.pendingCommission);
    s.approvedCommission = round2(s.approvedCommission);
    s.paidCommission = round2(s.paidCommission);
    s.totalCommission = round2(s.pendingCommission + s.approvedCommission + s.paidCommission);
  }
  return result;
}

/** AGT001, AGT002, ... one past the most recently issued code (row ids can have gaps, codes shouldn't). */
async function nextAgentCode(client: Prisma.TransactionClient | typeof db): Promise<string> {
  const last = await client.agent_profiles.findFirst({ orderBy: { id: "desc" }, select: { agent_code: true } });
  const lastNumber = Number(last?.agent_code.replace(/\D/g, "")) || 0;
  return `AGT${String(lastNumber + 1).padStart(3, "0")}`;
}

function isUniqueViolation(err: unknown) {
  return (err as { code?: string })?.code === "P2002";
}

const agentUserSelect = {
  id: true,
  uuid: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  is_active: true,
  createdAt: true,
  last_login_at: true,
  referral_code: true,
  agent_profile: true,
} satisfies Prisma.UserSelect;

type AgentUser = Prisma.UserGetPayload<{ select: typeof agentUserSelect }>;

function formatAgent(u: AgentUser, summary?: AgentSummary & { openPayouts: number }) {
  const code = u.agent_profile?.agent_code ?? null;
  const referralCode = u.referral_code ?? code;
  return {
    id: u.uuid ?? String(u.id),
    agentCode: code,
    name: u.name,
    email: u.email,
    phone: u.phone,
    isActive: u.is_active && u.status === "active",
    notes: u.agent_profile?.notes ?? null,
    referralCode,
    referralLink: referralCode ? buildReferralLink(referralCode) : null,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.last_login_at?.toISOString() ?? null,
    summary: summary ?? { ...emptySummary(), openPayouts: 0 },
  };
}

export type AgentDto = ReturnType<typeof formatAgent>;

export const agentService = {
  /**
   * Resolves the signed-in agent from the session user id (a UUID). This is
   * the ONLY way agent-facing code learns which agent it is acting for - no
   * agent id is ever accepted from a request.
   */
  async requireAgentContext(sessionUserId: string | undefined | null) {
    if (!sessionUserId) throw ApiError.unauthorized();
    const user = await db.user.findFirst({
      where: { OR: [{ uuid: sessionUserId }, ...(/^\d+$/.test(sessionUserId) ? [{ id: BigInt(sessionUserId) }] : [])] },
      select: { id: true, name: true, is_active: true, status: true, role: { select: { slug: true } } },
    });
    if (!user || user.role.slug !== "agent") throw ApiError.forbidden("Sales Partner access only");
    if (!user.is_active || user.status !== "active") {
      throw ApiError.forbidden("Your Sales Partner account is inactive. Please contact support.");
    }
    return { agentId: user.id, name: user.name };
  },

  async createAgent(input: CreateAgentInput, actor: AuditActor) {
    const role = await db.role.findFirst({ where: { slug: "agent" }, select: { id: true } });
    if (!role) throw ApiError.internal("Sales Partner role is not configured");

    if (await db.user.findFirst({ where: { email: input.email }, select: { id: true } })) {
      throw ApiError.conflict("An account with this email address already exists");
    }
    if (input.phone && (await db.user.findFirst({ where: { phone: input.phone }, select: { id: true } }))) {
      throw ApiError.conflict("An account with this phone number already exists");
    }
    const passwordHash = await bcrypt.hash(input.password, 12);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const created = await db.$transaction(async (tx) => {
          const agentCode = await nextAgentCode(tx);
          const user = await tx.user.create({
            data: {
              uuid: crypto.randomUUID(),
              name: input.name,
              email: input.email,
              phone: input.phone ?? null,
              password_hash: passwordHash,
              roleId: role.id,
              status: "active",
              email_verified_at: new Date(),
              referral_code: agentCode,
              created_by: actor.id,
              updated_by: actor.id,
            },
            select: { id: true },
          });
          await tx.agent_profiles.create({
            data: {
              user_id: user.id,
              agent_code: agentCode,
              notes: input.notes ?? null,
              created_by: actor.id,
              updated_by: actor.id,
            },
          });
          await writeAudit(tx, {
            entityType: "agent",
            entityId: user.id,
            agentId: user.id,
            action: "agent_created",
            actor,
            metadata: { agentCode },
          });
          return user.id;
        });
        return this.getAgentDetail(String(created));
      } catch (err) {
        // Two admins creating agents at once can race on the code; retry with the next one.
        if (isUniqueViolation(err) && attempt < 4) continue;
        throw err;
      }
    }
    throw ApiError.internal("Could not generate a Sales Partner code");
  },

  async updateAgent(agentRef: string, input: UpdateAgentInput, actor: AuditActor) {
    const agentId = await resolveAgentRef(agentRef);
    if (!agentId) throw ApiError.notFound("Sales Partner not found");

    if (input.phone) {
      const clash = await db.user.findFirst({ where: { phone: input.phone, id: { not: agentId } }, select: { id: true } });
      if (clash) throw ApiError.conflict("An account with this phone number already exists");
    }

    await db.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id: agentId }, select: { is_active: true, status: true } });
      const data: Prisma.UserUncheckedUpdateInput = { updated_by: actor.id };
      if (input.name !== undefined) data.name = input.name;
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.password) data.password_hash = await bcrypt.hash(input.password, 12);
      if (input.isActive !== undefined) {
        data.is_active = input.isActive;
        data.status = input.isActive ? "active" : "inactive";
      }
      await tx.user.update({ where: { id: agentId }, data });

      if (input.notes !== undefined) {
        await tx.agent_profiles.update({ where: { user_id: agentId }, data: { notes: input.notes, updated_by: actor.id } });
      }

      await writeAudit(tx, {
        entityType: "agent",
        entityId: agentId,
        agentId,
        action:
          input.isActive === undefined
            ? "agent_updated"
            : input.isActive
              ? "agent_activated"
              : "agent_deactivated",
        fromStatus: before ? (before.is_active ? "active" : "inactive") : null,
        toStatus: input.isActive === undefined ? null : input.isActive ? "active" : "inactive",
        actor,
        metadata: { fields: Object.keys(input).filter((k) => k !== "password"), passwordReset: Boolean(input.password) },
      });
    });
    return this.getAgentDetail(String(agentId));
  },

  async getAgentDetail(agentRef: string) {
    const agentId = await resolveAgentRef(agentRef);
    if (!agentId) throw ApiError.notFound("Sales Partner not found");
    const user = await db.user.findUnique({ where: { id: agentId }, select: agentUserSelect });
    if (!user) throw ApiError.notFound("Sales Partner not found");
    const summaries = await summariesFor([agentId]);
    return formatAgent(user, summaries.get(String(agentId)));
  },

  async listAgents(filters: { search?: string; status?: "active" | "inactive"; page?: number; limit?: number }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.UserWhereInput = { role: { slug: "agent" }, deleted_at: null };
    if (filters.status === "active") where.is_active = true;
    if (filters.status === "inactive") where.is_active = false;
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: term } },
            { email: { contains: term } },
            { phone: { contains: term } },
            { agent_profile: { agent_code: { contains: term } } },
          ],
        },
      ];
    }

    const [rows, total] = await Promise.all([
      db.user.findMany({
        where,
        select: agentUserSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);
    const summaries = await summariesFor(rows.map((r) => r.id));
    return {
      data: rows.map((r) => formatAgent(r, summaries.get(String(r.id)))),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  /** Lightweight id/name/code list for filter dropdowns. */
  async agentOptions() {
    const rows = await db.user.findMany({
      where: { role: { slug: "agent" }, deleted_at: null },
      select: { uuid: true, id: true, name: true, agent_profile: { select: { agent_code: true } } },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => ({
      id: r.uuid ?? String(r.id),
      name: r.name,
      agentCode: r.agent_profile?.agent_code ?? null,
    }));
  },

  async getSummary(agentId: bigint): Promise<AgentSummary> {
    const map = await summariesFor([agentId]);
    return map.get(String(agentId)) ?? emptySummary();
  },

  // ── Payment details (agent profile) ────────────────────────────────────────

  async getProfile(agentId: bigint) {
    const user = await db.user.findUnique({ where: { id: agentId }, select: agentUserSelect });
    if (!user) throw ApiError.notFound("Sales Partner not found");
    const p = user.agent_profile;
    return {
      ...formatAgent(user),
      payment: {
        preferredMethod: p?.preferred_payout_method ?? null,
        upiId: p?.upi_id ?? null,
        accountHolderName: p?.bank_account_holder ?? null,
        bankName: p?.bank_name ?? null,
        accountNumberMasked: maskAccountNumber(p?.bank_account_last4),
        ifsc: p?.bank_ifsc ?? null,
        hasUpi: Boolean(p?.upi_id),
        hasBank: Boolean(p?.bank_account_number_enc),
      },
    };
  },

  async savePaymentDetails(agentId: bigint, input: PaymentDetailsInput) {
    const data: Prisma.agent_profilesUpdateInput = {
      preferred_payout_method: input.method,
      updated_by: agentId,
    };
    if (input.method === "upi") {
      data.upi_id = input.upiId;
    } else {
      data.bank_account_holder = input.accountHolderName;
      data.bank_name = input.bankName;
      data.bank_account_number_enc = encryptField(input.accountNumber!);
      data.bank_account_last4 = input.accountNumber!.slice(-4);
      data.bank_ifsc = input.ifsc;
      // Changed bank details must be re-verified by the admin.
      data.bank_status = "pending";
      data.bank_remarks = null;
    }
    await db.$transaction(async (tx) => {
      await tx.agent_profiles.update({ where: { user_id: agentId }, data });
      await writeAudit(tx, {
        entityType: "agent",
        entityId: agentId,
        agentId,
        action: "payment_details_updated",
        actor: { id: agentId, role: "AGENT" },
        metadata: { method: input.method },
      });
    });
    return this.getProfile(agentId);
  },

  // ── Agent-facing lists (always scoped to a resolved agentId) ───────────────

  /** Customers who have ordered with this agent's referral code (derived from orders, not a fixed mapping). */
  async listCustomers(
    agentId: bigint,
    filters: { search?: string; page?: number; limit?: number }
  ): Promise<PaginatedResult<AgentCustomerRow>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.OrderWhereInput = { agent_id: agentId, is_active: true };
    if (filters.search?.trim()) where.user = customerSearchWhere(filters.search.trim());

    const [groups, allGroups] = await Promise.all([
      db.order.groupBy({
        by: ["userId"],
        where,
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: "desc" } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.order.groupBy({ by: ["userId"], where }),
    ]);
    const total = allGroups.length;

    const customerIds = groups.map((g) => g.userId);
    const [users, sales, commissions] = await Promise.all([
      db.user.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, uuid: true, name: true, email: true, phone: true, createdAt: true, is_active: true },
      }),
      db.order.groupBy({
        by: ["userId"],
        where: { ...where, userId: { in: customerIds }, order_status: { notIn: [...DEAD_ORDER_STATUSES] } },
        _count: { _all: true },
        _sum: { subtotal: true },
      }),
      db.commissions.groupBy({
        by: ["customer_id"],
        where: { agent_id: agentId, customer_id: { in: customerIds }, status: { notIn: ["cancelled", "reversed"] } },
        _sum: { commission_amount: true },
      }),
    ]);
    const userMap = new Map(users.map((u) => [String(u.id), u]));
    const salesMap = new Map(sales.map((o) => [String(o.userId), o]));
    const commissionMap = new Map(commissions.map((c) => [String(c.customer_id), c]));

    return {
      data: groups.flatMap((g) => {
        const u = userMap.get(String(g.userId));
        if (!u) return [];
        const o = salesMap.get(String(g.userId));
        return [
          {
            id: u.uuid ?? String(u.id),
            name: u.name,
            contact: u.email ?? u.phone ?? null,
            registeredAt: u.createdAt.toISOString(),
            lastOrderAt: g._max.createdAt?.toISOString() ?? null,
            totalOrders: o?._count._all ?? 0,
            totalSales: round2(Number(o?._sum.subtotal ?? 0)),
            commissionGenerated: round2(Number(commissionMap.get(String(g.userId))?._sum.commission_amount ?? 0)),
            status: u.is_active ? "active" : "inactive",
          },
        ];
      }),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  /**
   * Orders the Sales Partner placed for themselves (they are the buyer). Deliberately a different
   * query from referral orders (`agent_id` = partner): a self-purchase never carries an agent_id.
   */
  async listOwnPurchases(agentRef: string, paging: { page?: number; limit?: number }) {
    const agentId = await resolveAgentRef(agentRef);
    if (!agentId) throw ApiError.notFound("Sales Partner not found");
    const page = Math.max(1, paging.page ?? 1);
    const limit = Math.min(100, Math.max(1, paging.limit ?? 20));
    const where: Prisma.OrderWhereInput = { userId: agentId, is_active: true };
    const [rows, total] = await Promise.all([
      db.order.findMany({
        where,
        select: { uuid: true, orderNumber: true, totalAmount: true, order_status: true, payment_status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.order.count({ where }),
    ]);
    return {
      data: rows.map((o) => ({
        id: o.uuid ?? o.orderNumber,
        orderNumber: o.orderNumber,
        total: Number(o.totalAmount),
        orderStatus: String(o.order_status),
        paymentStatus: String(o.payment_status),
        orderDate: o.createdAt.toISOString(),
      })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    } satisfies PaginatedResult<OwnPurchaseRow>;
  },

  /** One row per order item of orders credited to the agent, with its commission. */
  async listOrderLines(
    filters: {
      agent?: string;
      customer?: string;
      order?: string;
      referralCode?: string;
      orderStatus?: string;
      commissionStatus?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    },
    scope: { agentId?: bigint } = {}
  ): Promise<PaginatedResult<AgentOrderLine>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const orderWhere: Prisma.OrderWhereInput = { is_active: true, agent_id: { not: null } };
    if (scope.agentId) {
      orderWhere.agent_id = scope.agentId;
    } else if (filters.agent) {
      orderWhere.agent_id = (await resolveAgentRef(filters.agent)) ?? BigInt(0);
    }
    if (filters.customer?.trim()) orderWhere.user = customerSearchWhere(filters.customer.trim());
    if (filters.referralCode?.trim()) orderWhere.referral_code = filters.referralCode.trim();
    if (filters.order?.trim()) orderWhere.OR = [{ orderNumber: { contains: filters.order.trim() } }, { uuid: filters.order.trim() }];
    if (filters.orderStatus) orderWhere.order_status = filters.orderStatus as Prisma.OrderWhereInput["order_status"];
    const from = filters.dateFrom ? startOfDay(filters.dateFrom) : null;
    const to = filters.dateTo ? endOfDay(filters.dateTo) : null;
    if (from || to) orderWhere.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

    const where: Prisma.OrderItemWhereInput = { is_active: true, order: orderWhere };
    if (filters.commissionStatus) {
      where.commission = { status: filters.commissionStatus as Prisma.commissionsWhereInput["status"] };
    }

    const [rows, total] = await Promise.all([
      db.orderItem.findMany({
        where,
        select: {
          id: true,
          product_name_snapshot: true,
          quantity: true,
          total_price: true,
          order: {
            select: {
              uuid: true,
              orderNumber: true,
              referral_code: true,
              createdAt: true,
              order_status: true,
              user: { select: { name: true, email: true, phone: true } },
              agent: { select: { name: true, agent_profile: { select: { agent_code: true } } } },
            },
          },
          commission: { select: { commission_percentage: true, commission_amount: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.orderItem.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: String(r.id),
        orderId: r.order.uuid ?? "",
        orderNumber: r.order.orderNumber,
        referralCode: r.order.referral_code,
        customerName: r.order.user.name,
        customerContact: r.order.user.email ?? r.order.user.phone ?? null,
        agentName: r.order.agent?.name ?? "",
        agentCode: r.order.agent?.agent_profile?.agent_code ?? null,
        orderDate: r.order.createdAt.toISOString(),
        productName: r.product_name_snapshot,
        quantity: r.quantity,
        productAmount: Number(r.total_price),
        orderStatus: r.order.order_status,
        commissionPercentage: r.commission ? Number(r.commission.commission_percentage) : null,
        commissionAmount: r.commission ? Number(r.commission.commission_amount) : null,
        commissionStatus: r.commission?.status ?? null,
      })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },
};

export interface AgentCustomerRow {
  id: string;
  name: string;
  contact: string | null;
  registeredAt: string;
  lastOrderAt: string | null;
  totalOrders: number;
  totalSales: number;
  commissionGenerated: number;
  status: string;
}

export interface AgentOrderLine {
  id: string;
  orderId: string;
  orderNumber: string;
  referralCode: string | null;
  customerName: string;
  customerContact: string | null;
  agentName: string;
  agentCode: string | null;
  orderDate: string;
  productName: string;
  quantity: number;
  productAmount: number;
  orderStatus: string;
  commissionPercentage: number | null;
  commissionAmount: number | null;
  commissionStatus: string | null;
}

export interface OwnPurchaseRow {
  id: string;
  orderNumber: string;
  total: number;
  orderStatus: string;
  paymentStatus: string;
  orderDate: string;
}
