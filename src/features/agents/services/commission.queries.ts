import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import type { CommissionFilters, CommissionRow } from "../types";

export const commissionInclude = {
  order: {
    select: {
      uuid: true,
      orderNumber: true,
      referral_code: true,
      order_status: true,
      return_requests: {
        select: {
          status: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
        take: 1,
      },
      replacement_requests: {
        select: {
          status: true,
          requested_at: true,
        },
        orderBy: { requested_at: "desc" },
        take: 1,
      },
    },
  },
  order_item: {
    select: {
      product_name_snapshot: true,
      quantity: true,
      return_items: {
        where: { is_active: true },
        select: {
          return_requests: {
            select: {
              status: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        take: 1,
      },
      replacement_request_items: {
        where: { is_active: true },
        select: {
          replacement_request: {
            select: {
              status: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        take: 1,
      },
    },
  },
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
      { uuid: { contains: term } },
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
  if (filters.orderStatus) {
    where.OR = [
      { order_status: filters.orderStatus },
      { order: { order_status: filters.orderStatus as any } },
    ];
  }
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

export function resolveProductOrderStatus(c: CommissionWithRelations): string {
  // 1. Check for return request on this specific item, fallback to order-level return request
  const returnReq =
    c.order_item?.return_items?.[0]?.return_requests ??
    c.order?.return_requests?.[0];

  if (returnReq) {
    const s = String(returnReq.status).toLowerCase();
    switch (s) {
      case "return_requested":
        return "return_requested";
      case "under_review":
        return "under_review";
      case "approved":
        return "return_approved";
      case "pickup_scheduled":
        return "pickup_scheduled";
      case "picked_up":
        return "picked_up";
      case "shipped_by_customer":
        return "return_shipped";
      case "received":
        return "return_received";
      case "qc_failed":
        return "qc_failed";
      case "returning_to_customer":
        return "returning_to_customer";
      case "returned_to_customer":
        return "returned_to_customer";
      case "refund_pending":
        return "refund_pending";
      case "refunded":
        return "returned";
      case "rejected":
        return "return_rejected";
      case "expired":
        return "return_expired";
      case "cancelled":
        return "return_cancelled";
      case "closed":
        return "return_closed";
      default:
        return s;
    }
  }

  // 2. Check for replacement request on this specific item, fallback to order-level replacement request
  const replacementReq =
    c.order_item?.replacement_request_items?.[0]?.replacement_request ??
    c.order?.replacement_requests?.[0];

  if (replacementReq) {
    const s = String(replacementReq.status).toLowerCase();
    switch (s) {
      case "replacement_requested":
        return "replacement_requested";
      case "under_review":
        return "under_review";
      case "approved":
        return "replacement_approved";
      case "pickup_scheduled":
        return "pickup_scheduled";
      case "picked_up":
        return "picked_up";
      case "replacement_processing":
        return "replacement_processing";
      case "replacement_shipped":
        return "replacement_shipped";
      case "replaced":
        return "replaced";
      case "rejected":
        return "replacement_rejected";
      case "expired":
        return "replacement_expired";
      case "cancelled":
        return "replacement_cancelled";
      case "closed":
        return "replacement_closed";
      default:
        return s;
    }
  }

  // 3. Fallback to the live order status from the parent order, or snapshot
  return String(c.order?.order_status ?? c.order_status ?? "pending");
}

export function formatCommissionRow(c: CommissionWithRelations): CommissionRow {
  return {
    id: c.uuid,
    code: padCode("CMS", c.id),
    orderId: c.order?.uuid ?? String(c.order_id),
    orderNumber: c.order?.orderNumber ?? "—",
    referralCode: c.referral_code ?? c.order?.referral_code ?? null,
    customerName: c.customer?.name ?? "—",
    customerContact: c.customer?.email ?? c.customer?.phone ?? null,
    agentName: c.agent?.name ?? "—",
    agentCode: c.agent?.agent_profile?.agent_code ?? null,
    productName: c.order_item?.product_name_snapshot ?? "—",
    categoryName: c.category?.name ?? null,
    quantity: c.order_item?.quantity ?? 1,
    productAmount: Number(c.product_amount),
    percentage: Number(c.commission_percentage),
    rateSource: c.rate_source,
    amount: Number(c.commission_amount),
    status: c.status,
    orderStatus: resolveProductOrderStatus(c),
    eligibleAt: c.return_period_ends_at?.toISOString() ?? null,
    approvedAt: c.approved_at?.toISOString() ?? null,
    paidAt: c.paid_at?.toISOString() ?? null,
    createdAt: c.created_at.toISOString(),
    clawbackDue: c.clawback_due,
    reversalReason: c.reversal_reason,
    payoutCode: c.payout_id ? padCode("PAY", c.payout_id) : null,
  };
}
