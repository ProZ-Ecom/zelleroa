import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import {
  SOLD_ORDER,
  bucketSql,
  change,
  fillSeries,
  inRange,
  num,
  pickBucket,
  resolveRange,
  round2,
  type Bucket,
  type ReportRange,
} from "../lib/report-range";
import { resolveAgentFilter } from "../lib/report-filters";
import { ORDER_SOURCE_LABELS } from "../lib/report-labels";

export interface SalesFilters {
  dateFrom?: string;
  dateTo?: string;
  agent?: string;
  source?: string;
}

export interface SalesTotals {
  orders: number;
  units: number;
  grossSales: number;
  discount: number;
  tax: number;
  shipping: number;
  netSales: number;
  avgOrderValue: number;
}

export interface SalesTrendPoint {
  bucket: string;
  orders: number;
  grossSales: number;
  netSales: number;
}

export interface SalesBreakdownRow {
  key: string;
  label: string;
  orders: number;
  units: number;
  netSales: number;
  share: number;
}

export interface SalesReport {
  range: { from: string; to: string; days: number; bucket: Bucket };
  totals: SalesTotals;
  previous: SalesTotals;
  changes: Record<keyof SalesTotals, number | null>;
  trend: SalesTrendPoint[];
  byCategory: SalesBreakdownRow[];
  byBrand: SalesBreakdownRow[];
  bySource: SalesBreakdownRow[];
  byAgent: SalesBreakdownRow[];
  topProducts: SalesBreakdownRow[];
  topCustomers: SalesBreakdownRow[];
}

const TOTAL_KEYS: (keyof SalesTotals)[] = [
  "orders",
  "units",
  "grossSales",
  "discount",
  "tax",
  "shipping",
  "netSales",
  "avgOrderValue",
];

/** Shared WHERE for the order side of every sales figure. */
function orderWhere(
  filters: SalesFilters,
  agentId: bigint | null,
  window: { from: Date; to: Date }
): Prisma.OrderWhereInput {
  return {
    ...SOLD_ORDER,
    createdAt: inRange(window),
    ...(agentId !== null ? { agent_id: agentId } : {}),
    ...(filters.source ? { order_source: filters.source as Prisma.OrderWhereInput["order_source"] } : {}),
  };
}

async function totalsFor(where: Prisma.OrderWhereInput): Promise<SalesTotals> {
  const [agg, unitAgg] = await Promise.all([
    db.order.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        shipping_charge: true,
        totalAmount: true,
      },
    }),
    db.orderItem.aggregate({ where: { is_active: true, order: where }, _sum: { quantity: true } }),
  ]);

  const orders = agg._count._all;
  const netSales = num(agg._sum.totalAmount);

  return {
    orders,
    units: unitAgg._sum.quantity ?? 0,
    grossSales: num(agg._sum.subtotal),
    discount: num(agg._sum.discountAmount),
    tax: num(agg._sum.taxAmount),
    shipping: num(agg._sum.shipping_charge),
    netSales,
    avgOrderValue: orders ? round2(netSales / orders) : 0,
  };
}

/** Rows keyed by one dimension, sorted by value, with each row's share of the total. */
function withShare(rows: Omit<SalesBreakdownRow, "share">[], total: number, limit?: number): SalesBreakdownRow[] {
  const sorted = [...rows].sort((a, b) => b.netSales - a.netSales);
  const sliced = limit ? sorted.slice(0, limit) : sorted;
  return sliced.map((r) => ({ ...r, share: total ? Math.round((r.netSales / total) * 1000) / 10 : 0 }));
}

export const salesReportService = {
  async summary(filters: SalesFilters): Promise<SalesReport> {
    const range = resolveRange(filters);
    const bucket = pickBucket(range.days);
    const agentId = await resolveAgentFilter(filters.agent);

    const where = orderWhere(filters, agentId, range);
    const prevWhere = orderWhere(filters, agentId, { from: range.prevFrom, to: range.prevTo });

    const [totals, previous, trendRows, itemRows, sourceRows, agentRows, customerRows] = await Promise.all([
      totalsFor(where),
      totalsFor(prevWhere),
      trend(range, bucket, filters, agentId),
      itemBreakdown(where),
      sourceBreakdown(where),
      agentBreakdown(where),
      customerBreakdown(where),
    ]);

    const changes = Object.fromEntries(
      TOTAL_KEYS.map((k) => [k, change(totals[k], previous[k])])
    ) as Record<keyof SalesTotals, number | null>;

    return {
      range: { from: range.fromISO, to: range.toISO, days: range.days, bucket },
      totals,
      previous,
      changes,
      trend: trendRows,
      byCategory: withShare(itemRows.categories, totals.grossSales),
      byBrand: withShare(itemRows.brands, totals.grossSales),
      bySource: withShare(sourceRows, totals.netSales),
      byAgent: withShare(agentRows, totals.netSales, 10),
      topProducts: withShare(itemRows.products, totals.grossSales, 10),
      topCustomers: withShare(customerRows, totals.netSales, 10),
    };
  },
};

async function trend(
  range: ReportRange,
  bucket: Bucket,
  filters: SalesFilters,
  agentId: bigint | null
): Promise<SalesTrendPoint[]> {
  const key = bucketSql(Prisma.sql`o.created_at`, bucket);
  const rows = await db.$queryRaw<
    { bucket: string; orders: bigint | number; gross: Prisma.Decimal | null; net: Prisma.Decimal | null }[]
  >(Prisma.sql`
      SELECT ${key} AS bucket,
             COUNT(*) AS orders,
             COALESCE(SUM(o.subtotal), 0) AS gross,
             COALESCE(SUM(o.total_amount), 0) AS net
      FROM orders o
      WHERE o.is_active = 1
        AND o.order_status NOT IN ('cancelled', 'returned')
        AND o.created_at BETWEEN ${range.from} AND ${range.to}
        ${agentId !== null ? Prisma.sql`AND o.agent_id = ${agentId}` : Prisma.empty}
        ${filters.source ? Prisma.sql`AND o.order_source = ${filters.source}` : Prisma.empty}
      GROUP BY bucket
      ORDER BY bucket
    `);

  return fillSeries(
    rows.map((r) => ({
      bucket: r.bucket,
      orders: Number(r.orders),
      grossSales: num(r.gross),
      netSales: num(r.net),
    })),
    range,
    bucket,
    (b) => ({ bucket: b, orders: 0, grossSales: 0, netSales: 0 })
  );
}

/** Category, brand and product rows all come from the same order-item scan. */
async function itemBreakdown(where: Prisma.OrderWhereInput) {
  const items = await db.orderItem.findMany({
    where: { is_active: true, order: where },
    select: {
      orderId: true,
      productId: true,
      product_name_snapshot: true,
      quantity: true,
      total_price: true,
      product: {
        select: {
          categoryId: true,
          brandId: true,
          brand: { select: { name: true } },
        },
      },
    },
  });

  // `products.category_id` carries no Prisma relation, so category names need their own read.
  const categoryIds = [...new Set(items.map((i) => i.product?.categoryId).filter((id): id is bigint => id != null))];
  const categoryNames = categoryIds.length
    ? new Map(
        (await db.productCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })).map(
          (c) => [String(c.id), c.name]
        )
      )
    : new Map<string, string>();

  type Acc = { label: string; orders: Set<string>; units: number; netSales: number };
  const categories = new Map<string, Acc>();
  const brands = new Map<string, Acc>();
  const products = new Map<string, Acc>();

  const bump = (map: Map<string, Acc>, key: string, label: string, orderId: string, units: number, value: number) => {
    const row = map.get(key) ?? { label, orders: new Set<string>(), units: 0, netSales: 0 };
    row.orders.add(orderId);
    row.units += units;
    row.netSales = round2(row.netSales + value);
    map.set(key, row);
  };

  for (const item of items) {
    const orderId = String(item.orderId);
    const value = num(item.total_price);
    const categoryId = item.product?.categoryId;
    bump(
      categories,
      String(categoryId ?? "none"),
      (categoryId != null ? categoryNames.get(String(categoryId)) : null) ?? "Uncategorised",
      orderId,
      item.quantity,
      value
    );
    bump(
      brands,
      String(item.product?.brandId ?? "none"),
      item.product?.brand?.name ?? "No brand",
      orderId,
      item.quantity,
      value
    );
    bump(products, String(item.productId), item.product_name_snapshot, orderId, item.quantity, value);
  }

  const flatten = (map: Map<string, Acc>) =>
    [...map.entries()].map(([key, v]) => ({
      key,
      label: v.label,
      orders: v.orders.size,
      units: v.units,
      netSales: v.netSales,
    }));

  return { categories: flatten(categories), brands: flatten(brands), products: flatten(products) };
}

async function sourceBreakdown(where: Prisma.OrderWhereInput) {
  const rows = await db.order.groupBy({
    by: ["order_source"],
    where,
    _count: { _all: true },
    _sum: { totalAmount: true },
  });
  return rows.map((r) => ({
    key: String(r.order_source),
    label: ORDER_SOURCE_LABELS[String(r.order_source)] ?? String(r.order_source),
    orders: r._count._all,
    units: 0,
    netSales: num(r._sum.totalAmount),
  }));
}

async function agentBreakdown(where: Prisma.OrderWhereInput) {
  const rows = await db.order.groupBy({
    by: ["agent_id"],
    where: { ...where, agent_id: { not: null } },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.agent_id).filter((id): id is bigint => id != null);
  const agents = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, agent_profile: { select: { agent_code: true } } },
  });
  const nameById = new Map(
    agents.map((a) => [String(a.id), `${a.name}${a.agent_profile?.agent_code ? ` (${a.agent_profile.agent_code})` : ""}`])
  );

  return rows.map((r) => ({
    key: String(r.agent_id),
    label: nameById.get(String(r.agent_id)) ?? `Partner #${r.agent_id}`,
    orders: r._count._all,
    units: 0,
    netSales: num(r._sum.totalAmount),
  }));
}

async function customerBreakdown(where: Prisma.OrderWhereInput) {
  const rows = await db.order.groupBy({
    by: ["userId"],
    where,
    _count: { _all: true },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: "desc" } },
    take: 25,
  });
  if (rows.length === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, cust_id: true },
  });
  const byId = new Map(users.map((u) => [String(u.id), u]));

  return rows.map((r) => {
    const u = byId.get(String(r.userId));
    return {
      key: String(r.userId),
      label: u ? `${u.name}${u.cust_id ? ` (${u.cust_id})` : ""}` : `Customer #${r.userId}`,
      orders: r._count._all,
      units: 0,
      netSales: num(r._sum.totalAmount),
    };
  });
}
