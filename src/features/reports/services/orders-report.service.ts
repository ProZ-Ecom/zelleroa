import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import {
  ACTIVE_ORDER,
  bucketSql,
  change,
  fillSeries,
  inRange,
  num,
  pickBucket,
  ratio,
  resolveRange,
  round2,
  type Bucket,
  type ReportRange,
} from "../lib/report-range";
import { resolveAgentFilter } from "../lib/report-filters";
import {
  IN_PROGRESS_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_ORDER,
  PAYMENT_STATUS_LABELS,
} from "../lib/report-labels";

const DAY_MS = 86_400_000;

export interface OrdersFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  paymentStatus?: string;
  agent?: string;
  source?: string;
}

export interface OrdersTotals {
  orders: number;
  value: number;
  delivered: number;
  deliveredValue: number;
  inProgress: number;
  cancelled: number;
  cancelledValue: number;
  returned: number;
  cancelRate: number;
  returnRate: number;
  fulfilmentRate: number;
  avgDeliveryDays: number | null;
}

export interface StatusRow {
  status: string;
  label: string;
  orders: number;
  value: number;
  share: number;
}

export interface ReasonRow {
  reason: string;
  by: string;
  orders: number;
  value: number;
}

export interface OrdersTrendPoint {
  bucket: string;
  placed: number;
  delivered: number;
  cancelled: number;
}

export interface OrderListRow {
  id: string;
  orderNumber: string;
  placedAt: string | null;
  customer: string;
  status: string;
  paymentStatus: string;
  source: string;
  items: number;
  value: number;
  deliveredAt: string | null;
  deliveryDays: number | null;
}

export interface OrdersReport {
  range: { from: string; to: string; days: number; bucket: Bucket };
  totals: OrdersTotals;
  previous: OrdersTotals;
  changes: Record<keyof OrdersTotals, number | null>;
  byStatus: StatusRow[];
  byPaymentStatus: StatusRow[];
  cancellationReasons: ReasonRow[];
  returnReasons: ReasonRow[];
  trend: OrdersTrendPoint[];
  orders: OrderListRow[];
  ordersTruncated: boolean;
}


const TOTAL_KEYS: (keyof OrdersTotals)[] = [
  "orders",
  "value",
  "delivered",
  "deliveredValue",
  "inProgress",
  "cancelled",
  "cancelledValue",
  "returned",
  "cancelRate",
  "returnRate",
  "fulfilmentRate",
  "avgDeliveryDays",
];

/** Orders report counts every order, cancelled ones included - that is the point of it. */
function orderWhere(
  filters: OrdersFilters,
  agentId: bigint | null,
  window: { from: Date; to: Date }
): Prisma.OrderWhereInput {
  return {
    ...ACTIVE_ORDER,
    createdAt: inRange(window),
    ...(agentId !== null ? { agent_id: agentId } : {}),
    ...(filters.status ? { order_status: filters.status as Prisma.OrderWhereInput["order_status"] } : {}),
    ...(filters.paymentStatus
      ? { payment_status: filters.paymentStatus as Prisma.OrderWhereInput["payment_status"] }
      : {}),
    ...(filters.source ? { order_source: filters.source as Prisma.OrderWhereInput["order_source"] } : {}),
  };
}

function statusRows(
  rows: { key: string; orders: number; value: number }[],
  labels: Record<string, string>,
  order: string[],
  totalOrders: number
): StatusRow[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const known = order.filter((k) => byKey.has(k)).map((k) => byKey.get(k)!);
  const extra = rows.filter((r) => !order.includes(r.key));
  return [...known, ...extra].map((r) => ({
    status: r.key,
    label: labels[r.key] ?? r.key,
    orders: r.orders,
    value: r.value,
    share: ratio(r.orders, totalOrders),
  }));
}

async function totalsFor(
  where: Prisma.OrderWhereInput
): Promise<{ totals: OrdersTotals; statusGroups: { key: string; orders: number; value: number }[] }> {
  const [groups, deliveredOrders] = await Promise.all([
    db.order.groupBy({
      by: ["order_status"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    // Average placed -> delivered gap, over the orders in range that actually got there.
    db.order.findMany({
      where: { ...where, delivered_at: { not: null } },
      select: { placed_at: true, createdAt: true, delivered_at: true },
    }),
  ]);

  const gaps = deliveredOrders
    .map((o) => {
      const start = o.placed_at ?? o.createdAt;
      return start && o.delivered_at ? (o.delivered_at.getTime() - start.getTime()) / DAY_MS : null;
    })
    .filter((d): d is number => d != null && d >= 0);
  const avgDays = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

  const statusGroups = groups.map((g) => ({
    key: String(g.order_status),
    orders: g._count._all,
    value: num(g._sum.totalAmount),
  }));

  const pick = (keys: readonly string[]) =>
    statusGroups.filter((g) => keys.includes(g.key)).reduce(
      (acc, g) => ({ orders: acc.orders + g.orders, value: round2(acc.value + g.value) }),
      { orders: 0, value: 0 }
    );

  const all = pick(ORDER_STATUS_ORDER);
  const delivered = pick(["delivered"]);
  const cancelled = pick(["cancelled"]);
  const returned = pick(["returned"]);
  const inProgress = pick(IN_PROGRESS_STATUSES);

  return {
    totals: {
      orders: all.orders,
      value: all.value,
      delivered: delivered.orders,
      deliveredValue: delivered.value,
      inProgress: inProgress.orders,
      cancelled: cancelled.orders,
      cancelledValue: cancelled.value,
      returned: returned.orders,
      cancelRate: ratio(cancelled.orders, all.orders),
      returnRate: ratio(returned.orders, all.orders),
      fulfilmentRate: ratio(delivered.orders, all.orders),
      avgDeliveryDays: avgDays == null ? null : Math.round(avgDays * 10) / 10,
    },
    statusGroups,
  };
}

const ORDER_LIST_LIMIT = 500;

export const ordersReportService = {
  async summary(filters: OrdersFilters): Promise<OrdersReport> {
    const range = resolveRange(filters);
    const bucket = pickBucket(range.days);
    const agentId = await resolveAgentFilter(filters.agent);

    const where = orderWhere(filters, agentId, range);
    const prevWhere = orderWhere(filters, agentId, { from: range.prevFrom, to: range.prevTo });

    const [current, previous, paymentGroups, cancellation, returns, trendRows, list] = await Promise.all([
      totalsFor(where),
      totalsFor(prevWhere),
      db.order.groupBy({
        by: ["payment_status"],
        where,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      cancellationReasons(where),
      returnReasons(range),
      trend(range, bucket, filters, agentId),
      orderList(where),
    ]);

    const changes = Object.fromEntries(
      TOTAL_KEYS.map((k) => [k, change(Number(current.totals[k] ?? 0), Number(previous.totals[k] ?? 0))])
    ) as Record<keyof OrdersTotals, number | null>;

    return {
      range: { from: range.fromISO, to: range.toISO, days: range.days, bucket },
      totals: current.totals,
      previous: previous.totals,
      changes,
      byStatus: statusRows(current.statusGroups, ORDER_STATUS_LABELS, ORDER_STATUS_ORDER, current.totals.orders),
      byPaymentStatus: statusRows(
        paymentGroups.map((g) => ({
          key: String(g.payment_status),
          orders: g._count._all,
          value: num(g._sum.totalAmount),
        })),
        PAYMENT_STATUS_LABELS,
        Object.keys(PAYMENT_STATUS_LABELS),
        current.totals.orders
      ),
      cancellationReasons: cancellation,
      returnReasons: returns,
      trend: trendRows,
      orders: list,
      ordersTruncated: list.length === ORDER_LIST_LIMIT,
    };
  },
};

async function cancellationReasons(where: Prisma.OrderWhereInput): Promise<ReasonRow[]> {
  const rows = await db.order.groupBy({
    by: ["cancellation_reason", "cancelled_by"],
    where: { ...where, order_status: "cancelled" },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });
  return rows
    .map((r) => ({
      reason: r.cancellation_reason ?? "Not stated",
      by: r.cancelled_by ?? "Unknown",
      orders: r._count._all,
      value: num(r._sum.totalAmount),
    }))
    .sort((a, b) => b.orders - a.orders);
}

async function returnReasons(range: ReportRange): Promise<ReasonRow[]> {
  const rows = await db.return_requests.groupBy({
    by: ["reason", "status"],
    where: { is_active: true, requested_at: inRange(range) },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ reason: r.reason, by: String(r.status), orders: r._count._all, value: 0 }))
    .sort((a, b) => b.orders - a.orders);
}

async function trend(
  range: ReportRange,
  bucket: Bucket,
  filters: OrdersFilters,
  agentId: bigint | null
): Promise<OrdersTrendPoint[]> {
  const key = bucketSql(Prisma.sql`o.created_at`, bucket);
  const rows = await db.$queryRaw<
    { bucket: string; placed: bigint | number; delivered: bigint | number; cancelled: bigint | number }[]
  >(Prisma.sql`
      SELECT ${key} AS bucket,
             COUNT(*) AS placed,
             SUM(o.order_status = 'delivered') AS delivered,
             SUM(o.order_status = 'cancelled') AS cancelled
      FROM orders o
      WHERE o.is_active = 1
        AND o.created_at BETWEEN ${range.from} AND ${range.to}
        ${agentId !== null ? Prisma.sql`AND o.agent_id = ${agentId}` : Prisma.empty}
        ${filters.source ? Prisma.sql`AND o.order_source = ${filters.source}` : Prisma.empty}
        ${filters.status ? Prisma.sql`AND o.order_status = ${filters.status}` : Prisma.empty}
        ${filters.paymentStatus ? Prisma.sql`AND o.payment_status = ${filters.paymentStatus}` : Prisma.empty}
      GROUP BY bucket
      ORDER BY bucket
    `);

  return fillSeries(
    rows.map((r) => ({
      bucket: r.bucket,
      placed: Number(r.placed),
      delivered: Number(r.delivered ?? 0),
      cancelled: Number(r.cancelled ?? 0),
    })),
    range,
    bucket,
    (b) => ({ bucket: b, placed: 0, delivered: 0, cancelled: 0 })
  );
}

async function orderList(where: Prisma.OrderWhereInput): Promise<OrderListRow[]> {
  const rows = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: ORDER_LIST_LIMIT,
    select: {
      id: true,
      orderNumber: true,
      placed_at: true,
      createdAt: true,
      delivered_at: true,
      order_status: true,
      payment_status: true,
      order_source: true,
      totalAmount: true,
      is_manual_customer: true,
      manual_customer_name: true,
      user: { select: { name: true, cust_id: true } },
      _count: { select: { items: true } },
    },
  });

  return rows.map((o) => {
    const start = o.placed_at ?? o.createdAt;
    const deliveryDays =
      o.delivered_at && start ? Math.round(((o.delivered_at.getTime() - start.getTime()) / DAY_MS) * 10) / 10 : null;
    const customer = o.is_manual_customer
      ? `${o.manual_customer_name ?? "Walk-in"} (manual)`
      : `${o.user?.name ?? "Unknown"}${o.user?.cust_id ? ` (${o.user.cust_id})` : ""}`;

    return {
      id: String(o.id),
      orderNumber: o.orderNumber,
      placedAt: (o.placed_at ?? o.createdAt)?.toISOString() ?? null,
      customer,
      status: String(o.order_status),
      paymentStatus: String(o.payment_status),
      source: String(o.order_source),
      items: o._count.items,
      value: num(o.totalAmount),
      deliveredAt: o.delivered_at?.toISOString() ?? null,
      deliveryDays,
    };
  });
}
