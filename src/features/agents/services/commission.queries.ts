import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import type { CommissionFilters, CommissionRow } from "../types";

export const commissionInclude = {
  order: { select: { uuid: true, orderNumber: true, referral_code: true } },
  order_item: { select: { product_name_snapshot: true, quantity: true } },
  customer: { select: { name: true, email: true, phone: true } },
  agent: { select: { name: true, agent_profile: { select: { agent_code: true } } } },
  payout: { select: { id: true } },
  category: { select: { name: true } },
} satisfies Prisma.commissionsInclude;

type CommissionWithRelations = Prisma.commissionsGetPayload<{ include: typeof commissionInclude }>;

export function padCode(prefix: string, id: bigint | number | string): string {
  return `${prefix}-${String(id).padStart(6, "0")}`;
}

export function endOfDay(value: string): Date | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // A bare YYYY-MM-DD means "through the end of that day".
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function startOfDay(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Resolves an agent reference (uuid, agent code such as AGT001, or numeric id) to users.id. */
export async function resolveAgentRef(ref?: string | null): Promise<bigint | null> {
  if (!ref) return null;
  const agent = await db.user.findFirst({
    where: {
      role: { slug: "agent" },
      OR: [
        { uuid: ref },
        { agent_profile: { agent_code: ref } },
        ...(/^\d+$/.test(ref) ? [{ id: BigInt(ref) }] : []),
      ],
    },
    select: { id: true },
  });
  return agent?.id ?? null;
}

export function customerSearchWhere(term: string): Prisma.UserWhereInput {
  return {
    OR: [
      { uuid: term },
      { name: { contains: term } },
      { email: { contains: term } },
      { phone: { contains: term } },
    ],
  };
}

const COMMISSION_STATUSES = new Set([
  "pending",
  "pending_approval",
  "approved",
  "payout_requested",
  "payout_approved",
  "paid",
  "cancelled",
  "reversed",
]);

/**
 * Builds the commission filter. `scope.agentId` (set for agent-facing calls)
 * always wins: an agent-supplied `filters.agent` is ignored so no request
 * parameter can widen an agent's view to somebody else's data.
 */
export async function buildCommissionWhere(
  filters: CommissionFilters,
  scope: { agentId?: bigint } = {}
): Promise<Prisma.commissionsWhereInput> {
  const where: Prisma.commissionsWhereInput = {};

  if (scope.agentId) {
    where.agent_id = scope.agentId;
  } else if (filters.agent) {
    const agentId = await resolveAgentRef(filters.agent);
    // An unknown agent must match nothing rather than silently match everything.
    where.agent_id = agentId ?? BigInt(0);
  }

  if (filters.customer?.trim()) where.customer = customerSearchWhere(filters.customer.trim());
  if (filters.status && COMMISSION_STATUSES.has(filters.status)) {
    where.status = filters.status as Prisma.commissionsWhereInput["status"];
  }
  if (filters.orderStatus) where.order_status = filters.orderStatus;
  if (filters.referralCode?.trim()) where.referral_code = filters.referralCode.trim();
  if (filters.order?.trim()) {
    const term = filters.order.trim();
    where.order = { OR: [{ orderNumber: { contains: term } }, { uuid: term }] };
  }

  const from = filters.dateFrom ? startOfDay(filters.dateFrom) : null;
  const to = filters.dateTo ? endOfDay(filters.dateTo) : null;
  if (from || to) {
    where.created_at = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  }
  return where;
}

export function formatCommissionRow(c: CommissionWithRelations): CommissionRow {
  return {
    id: c.uuid,
    code: padCode("CMS", c.id),
    orderId: c.order.uuid ?? String(c.order_id),
    orderNumber: c.order.orderNumber,
    referralCode: c.referral_code ?? c.order.referral_code ?? null,
    customerName: c.customer.name,
    customerContact: c.customer.email ?? c.customer.phone ?? null,
    agentName: c.agent.name,
    agentCode: c.agent.agent_profile?.agent_code ?? null,
    productName: c.order_item.product_name_snapshot,
    categoryName: c.category?.name ?? null,
    quantity: c.order_item.quantity,
    productAmount: Number(c.product_amount),
    percentage: Number(c.commission_percentage),
    rateSource: c.rate_source,
    amount: Number(c.commission_amount),
    status: c.status,
    orderStatus: c.order_status,
    eligibleAt: c.return_period_ends_at?.toISOString() ?? null,
    approvedAt: c.approved_at?.toISOString() ?? null,
    paidAt: c.paid_at?.toISOString() ?? null,
    createdAt: c.created_at.toISOString(),
    clawbackDue: c.clawback_due,
    reversalReason: c.reversal_reason,
    payoutCode: c.payout_id ? padCode("PAY", c.payout_id) : null,
  };
}
