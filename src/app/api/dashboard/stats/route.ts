import { db } from "@/lib/db/prisma";
import { apiSuccess } from "@/lib/api/api-response";
import { createApiHandler } from "@/lib/api/api-handler";

const ALLOWED_RANGES = [7, 30, 90];

function growth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}


type Bounds = { gte: Date; lt: Date } | undefined;

/**
 * Sales   = value of all orders that were not cancelled/returned.
 * Revenue = the part of that value actually collected (payment_status = paid).
 */
async function metricsFor(bounds: Bounds) {
  const created = bounds ? { createdAt: bounds } : {};
  const live = { order_status: { notIn: ["cancelled" as const, "returned" as const] } };
  const [users, agents, orders, sales, revenue, cancelled, returned, pending] =
    await Promise.all([
      db.user.count({ where: { role: { name: "CUSTOMER" }, ...created } }),
      db.user.count({ where: { role: { slug: "agent" }, ...created } }),
      db.order.count({ where: created }),
      db.order.aggregate({ where: { ...created, ...live }, _sum: { totalAmount: true } }),
      db.order.aggregate({
        where: { ...created, ...live, payment_status: "paid" },
        _sum: { totalAmount: true },
      }),
      db.order.count({ where: { ...created, order_status: "cancelled" } }),
      db.order.count({ where: { ...created, order_status: "returned" } }),
      db.order.count({ where: { ...created, order_status: "pending" } }),
    ]);
  return {
    users,
    agents,
    orders,
    sales: Number(sales._sum.totalAmount ?? 0),
    revenue: Number(revenue._sum.totalAmount ?? 0),
    cancelled,
    returned,
    pending,
  };
}

type Metrics = Awaited<ReturnType<typeof metricsFor>>;

function compare(current: Metrics, base: Metrics) {
  const out = {} as Record<keyof Metrics, number | null>;
  (Object.keys(current) as (keyof Metrics)[]).forEach((k) => {
    out[k] = growth(current[k], base[k]);
  });
  return out;
}

async function agentStats(periodStart: Date) {
  const liveCommission = { status: { notIn: ["cancelled" as const, "reversed" as const] } };
  const [
    activeAgents,
    inactiveAgents,
    kycPending,
    bankPending,
    owed,
    paid,
    payoutRequested,
    agentOrders,
    agentCommissions,
  ] = await Promise.all([
    db.user.count({ where: { role: { slug: "agent" }, status: "active", is_active: true } }),
    db.user.count({
      where: { role: { slug: "agent" }, OR: [{ status: { not: "active" } }, { is_active: false }] },
    }),
    db.agent_profiles.count({ where: { kyc_status: "pending" } }),
    db.agent_profiles.count({ where: { bank_status: "pending" } }),
    db.commissions.aggregate({
      where: { status: { in: ["pending", "approved"] } },
      _sum: { commission_amount: true },
    }),
    db.commissions.aggregate({
      where: { status: "paid" },
      _sum: { commission_amount: true },
    }),
    db.commissions.aggregate({
      where: { status: { in: ["payout_requested", "payout_approved"] } },
      _sum: { commission_amount: true },
    }),
    db.order.groupBy({
      by: ["agent_id"],
      where: {
        agent_id: { not: null },
        createdAt: { gte: periodStart },
        order_status: { notIn: ["cancelled", "returned"] },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
    db.commissions.groupBy({
      by: ["agent_id"],
      where: { created_at: { gte: periodStart }, ...liveCommission },
      _sum: { commission_amount: true },
    }),
  ]);

  const agentIds = agentOrders.map((a) => a.agent_id!);
  const [users, profiles] = agentIds.length
    ? await Promise.all([
        db.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, uuid: true, name: true } }),
        db.agent_profiles.findMany({
          where: { user_id: { in: agentIds } },
          select: { user_id: true, agent_code: true },
        }),
      ])
    : [[], []];

  return {
    active: activeAgents,
    inactive: inactiveAgents,
    kycPending,
    bankPending,
    commissionOwed: Number(owed._sum.commission_amount ?? 0),
    commissionPaid: Number(paid._sum.commission_amount ?? 0),
    payoutRequested: Number(payoutRequested._sum.commission_amount ?? 0),
    topAgents: agentOrders.map((a) => ({
      id: users.find((u) => u.id === a.agent_id)?.uuid ?? String(a.agent_id),
      name: users.find((u) => u.id === a.agent_id)?.name ?? "Agent",
      code: profiles.find((x) => x.user_id === a.agent_id)?.agent_code ?? null,
      orders: a._count._all,
      sales: Number(a._sum.totalAmount ?? 0),
      commission: Number(
        agentCommissions.find((c) => c.agent_id === a.agent_id)?._sum.commission_amount ?? 0
      ),
    })),
  };
}

async function getStats(searchParams?: URLSearchParams) {
  const requested = Number(searchParams?.get("range"));
  const range = ALLOWED_RANGES.includes(requested) ? requested : 7;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodStart = new Date(todayStart);
  periodStart.setDate(todayStart.getDate() - (range - 1));
  const prevStart = new Date(periodStart);
  prevStart.setDate(periodStart.getDate() - range);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setDate(todayStart.getDate() - 7);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 1);

  const [agents, overall, today, yesterday, lastWeek] = await Promise.all([
    agentStats(periodStart),
    metricsFor(undefined),
    metricsFor({ gte: todayStart, lt: tomorrowStart }),
    metricsFor({ gte: yesterdayStart, lt: todayStart }),
    metricsFor({ gte: lastWeekStart, lt: lastWeekEnd }),
  ]);

  const notCancelled = { order_status: { not: "cancelled" as const } };

  const [
    totalProducts,
    totalCategories,
    totalCustomers,
    totalOrders,
    revenueResult,
    pendingOrders,
    lowStock,
    todayOrders,
    periodOrders,
    prevOrders,
    newCustomers,
    prevNewCustomers,
    statusGroups,
    paymentGroups,
    recentOrdersRaw,
    topProductsRaw,
    lowStockRows,
    topCustomersRaw,
    openReturns,
    outOfStock,
  ] = await Promise.all([
    db.product.count(),
    db.productCategory.count(),
    db.user.count({ where: { role: { name: "CUSTOMER" } } }),
    db.order.count(),
    db.order.aggregate({ where: notCancelled, _sum: { totalAmount: true } }),
    db.order.count({ where: { order_status: "pending" } }),
    db.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM inventories WHERE quantity_available <= reorder_level`.then(
      (rows) => Number(rows[0]?.count ?? 0)
    ),
    db.order.count({ where: { createdAt: { gte: todayStart } } }),
    db.order.findMany({
      where: { createdAt: { gte: periodStart }, ...notCancelled },
      select: { createdAt: true, totalAmount: true },
    }),
    db.order.findMany({
      where: { createdAt: { gte: prevStart, lt: periodStart }, ...notCancelled },
      select: { totalAmount: true },
    }),
    db.user.count({
      where: { role: { name: "CUSTOMER" }, createdAt: { gte: periodStart } },
    }),
    db.user.count({
      where: { role: { name: "CUSTOMER" }, createdAt: { gte: prevStart, lt: periodStart } },
    }),
    db.order.groupBy({
      by: ["order_status"],
      where: { createdAt: { gte: periodStart } },
      _count: { _all: true },
    }),
    db.order.groupBy({
      by: ["payment_status"],
      where: { createdAt: { gte: periodStart }, ...notCancelled },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        uuid: true,
        orderNumber: true,
        createdAt: true,
        totalAmount: true,
        order_status: true,
        user: { select: { name: true } },
      },
    }),
    db.orderItem.groupBy({
      by: ["product_name_snapshot"],
      where: { order: { createdAt: { gte: periodStart }, ...notCancelled } },
      _sum: { quantity: true, total_price: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 6,
    }),
    db.$queryRaw<
      { sku: string; item_name: string; variant_name: string; quantity_available: number; reorder_level: number }[]
    >`SELECT vup.sku, it.name AS item_name, pv.variant_name, i.quantity_available, i.reorder_level
      FROM inventories i
      JOIN variant_unit_prices vup ON vup.id = i.variant_unit_price_id
      JOIN product_variants pv ON pv.id = vup.variant_id
      JOIN items it ON it.id = pv.item_id
      WHERE i.quantity_available <= i.reorder_level
      ORDER BY i.quantity_available ASC
      LIMIT 6`,
    db.order.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: periodStart }, ...notCancelled },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
    db.return_requests.count({
      where: { status: { in: ["return_requested", "under_review", "refund_pending"] } },
    }),
    db.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM inventories WHERE quantity_available <= 0`.then(
      (rows) => Number(rows[0]?.count ?? 0)
    ),
  ]);

  const customerNames = topCustomersRaw.length
    ? await db.user.findMany({
        where: { id: { in: topCustomersRaw.map((c) => c.userId) } },
        select: { id: true, name: true, email: true },
      })
    : [];

  // Daily revenue/orders series across the selected range
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const o of periodOrders) {
    const k = dayKey(o.createdAt);
    const cur = byDay.get(k) ?? { revenue: 0, orders: 0 };
    cur.revenue += Number(o.totalAmount);
    cur.orders += 1;
    byDay.set(k, cur);
  }
  const salesTrend = Array.from({ length: range }, (_, i) => {
    const day = new Date(periodStart);
    day.setDate(periodStart.getDate() + i);
    const v = byDay.get(dayKey(day)) ?? { revenue: 0, orders: 0 };
    return {
      label:
        range <= 7
          ? day.toLocaleDateString("en-US", { weekday: "short" })
          : day.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      value: v.revenue,
      orders: v.orders,
    };
  });

  const periodRevenue = periodOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const periodCount = periodOrders.length;
  const prevCount = prevOrders.length;
  const aov = periodCount ? periodRevenue / periodCount : 0;
  const prevAov = prevCount ? prevRevenue / prevCount : 0;

  return apiSuccess({
    range,
    agents,
    overall,
    today,
    todayVsYesterday: compare(today, yesterday),
    todayVsLastWeek: compare(today, lastWeek),
    totalProducts,
    totalCategories,
    totalCustomers,
    totalOrders,
    totalRevenue: Number(revenueResult._sum.totalAmount ?? 0),
    pendingOrders,
    lowStock,
    todayOrders,
    outOfStock,
    openReturns,
    period: {
      revenue: periodRevenue,
      orders: periodCount,
      avgOrderValue: aov,
      newCustomers,
      revenueGrowth: growth(periodRevenue, prevRevenue),
      ordersGrowth: growth(periodCount, prevCount),
      aovGrowth: growth(aov, prevAov),
      customersGrowth: growth(newCustomers, prevNewCustomers),
    },
    salesTrend,
    ordersByStatus: statusGroups.map((g) => ({
      status: g.order_status,
      count: g._count._all,
    })),
    paymentBreakdown: paymentGroups.map((g) => ({
      status: g.payment_status,
      count: g._count._all,
      amount: Number(g._sum.totalAmount ?? 0),
    })),
    recentOrders: recentOrdersRaw.map((o) => ({
      id: o.orderNumber,
      uuid: o.uuid,
      customer: o.user.name,
      date: o.createdAt.toISOString(),
      amount: Number(o.totalAmount),
      status: o.order_status,
    })),
    topProducts: topProductsRaw.map((p) => ({
      id: p.product_name_snapshot,
      name: p.product_name_snapshot,
      unitsSold: p._sum.quantity ?? 0,
      revenue: Number(p._sum.total_price ?? 0),
    })),
    topCustomers: topCustomersRaw.map((c) => {
      const u = customerNames.find((n) => n.id === c.userId);
      return {
        id: String(c.userId),
        name: u?.name ?? "Customer",
        email: u?.email ?? null,
        orders: c._count._all,
        spent: Number(c._sum.totalAmount ?? 0),
      };
    }),
    lowStockItems: lowStockRows.map((r) => ({
      id: r.sku,
      name: r.item_name,
      variant: r.variant_name || null,
      sku: r.sku,
      stock: Number(r.quantity_available),
      reorderLevel: Number(r.reorder_level),
    })),
  });
}

export const GET = createApiHandler(
  { GET: async (_req, ctx) => getStats(ctx.searchParams) },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
