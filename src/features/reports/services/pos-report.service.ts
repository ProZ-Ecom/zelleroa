import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import {
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
import { resolveCashierFilter } from "../lib/report-filters";
import { POS_METHOD_CODES } from "@/features/pos/services/pos-session.service";

export interface PosFilters {
  dateFrom?: string;
  dateTo?: string;
  cashier?: string;
  tender?: string;
  status?: string;
}

export interface PosTotals {
  netSales: number;
  bills: number;
  units: number;
  avgBillValue: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  voidedBills: number;
  voidedAmount: number;
  totalShifts: number;
  cashVariance: number;
}

export interface PosTrendPoint {
  bucket: string;
  bills: number;
  netSales: number;
  cash: number;
  upi: number;
  card: number;
}

export interface PosTenderRow {
  code: string;
  label: string;
  bills: number;
  sales: number;
  share: number;
  avgTicket: number;
}

export interface PosCashierRow {
  id: string;
  name: string;
  email: string;
  bills: number;
  netSales: number;
  avgBillValue: number;
  voidedBills: number;
  cashVariance: number;
  share: number;
}

export interface PosHourRow {
  hour: number;
  label: string;
  bills: number;
  sales: number;
  share: number;
}

export interface PosProductRow {
  productId: string;
  name: string;
  sku: string;
  units: number;
  sales: number;
  share: number;
}

export interface PosShiftRow {
  id: string;
  uuid: string;
  cashierName: string;
  storeName: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  variance: number | null;
  varianceReason: string | null;
  status: string;
}

export interface PosReport {
  range: { from: string; to: string; days: number; bucket: Bucket };
  totals: PosTotals;
  previous: PosTotals;
  changes: Record<keyof PosTotals, number | null>;
  trend: PosTrendPoint[];
  byTender: PosTenderRow[];
  byCashier: PosCashierRow[];
  byHour: PosHourRow[];
  topProducts: PosProductRow[];
  shifts: PosShiftRow[];
}

const TOTAL_KEYS: (keyof PosTotals)[] = [
  "netSales",
  "bills",
  "units",
  "avgBillValue",
  "cashSales",
  "upiSales",
  "cardSales",
  "voidedBills",
  "voidedAmount",
  "totalShifts",
  "cashVariance",
];

export const posReportService = {
  async getReport(filters: PosFilters): Promise<PosReport> {
    const range = resolveRange(filters);
    const cashierId = await resolveCashierFilter(filters.cashier);
    const bucket = pickBucket(range.days);

    const [
      totals,
      previous,
      trendPoints,
      tenders,
      cashiers,
      hours,
      products,
      shiftsList,
    ] = await Promise.all([
      computeTotals(range.from, range.to, cashierId, filters),
      computeTotals(range.prevFrom, range.prevTo, cashierId, filters),
      computeTrend(range, bucket, cashierId),
      computeTenderBreakdown(range.from, range.to, cashierId),
      computeCashierBreakdown(range.from, range.to, cashierId),
      computeHourlyBreakdown(range.from, range.to, cashierId),
      computeTopProducts(range.from, range.to, cashierId),
      computeRecentShifts(range.from, range.to, cashierId),
    ]);

    const changes = Object.fromEntries(
      TOTAL_KEYS.map((k) => [k, change(totals[k], previous[k])])
    ) as Record<keyof PosTotals, number | null>;

    return {
      range: { from: range.fromISO, to: range.toISO, days: range.days, bucket },
      totals,
      previous,
      changes,
      trend: trendPoints,
      byTender: tenders,
      byCashier: cashiers,
      byHour: hours,
      topProducts: products,
      shifts: shiftsList,
    };
  },
};

/** Compute aggregate KPI totals for a specific time window */
async function computeTotals(
  from: Date,
  to: Date,
  cashierId: bigint | null,
  filters: PosFilters
): Promise<PosTotals> {
  const baseOrderWhere: Prisma.OrderWhereInput = {
    is_active: true,
    order_source: "POS",
    createdAt: inRange({ from, to }),
    ...(cashierId ? { ordered_by_id: cashierId } : {}),
    ...(filters.tender
      ? {
          payments: {
            some: { payment_methods: { code: filters.tender } },
          },
        }
      : {}),
  };

  const [deliveredAgg, voidedAgg, unitAgg, payments, shifts] = await Promise.all([
    // Delivered / completed bills
    db.order.aggregate({
      where: {
        ...baseOrderWhere,
        order_status: "delivered",
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    // Voided / cancelled bills
    db.order.aggregate({
      where: {
        ...baseOrderWhere,
        order_status: "cancelled",
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    // Total units sold across delivered counter bills
    db.orderItem.aggregate({
      where: {
        is_active: true,
        order: {
          ...baseOrderWhere,
          order_status: "delivered",
        },
      },
      _sum: { quantity: true },
    }),
    // Payment tenders for delivered bills
    db.payment.findMany({
      where: {
        order: {
          ...baseOrderWhere,
          order_status: "delivered",
        },
      },
      select: {
        amount: true,
        payment_methods: { select: { code: true } },
      },
    }),
    // Shifts in window
    db.pos_sessions.findMany({
      where: {
        opened_at: inRange({ from, to }),
        ...(cashierId ? { staff_user_id: cashierId } : {}),
      },
      select: {
        cash_variance: true,
      },
    }),
  ]);

  const netSales = num(deliveredAgg._sum.totalAmount);
  const bills = deliveredAgg._count._all;
  const units = Number(unitAgg._sum.quantity ?? 0);
  const avgBillValue = bills > 0 ? round2(netSales / bills) : 0;

  const voidedBills = voidedAgg._count._all;
  const voidedAmount = num(voidedAgg._sum.totalAmount);

  let cashSales = 0;
  let upiSales = 0;
  let cardSales = 0;

  for (const p of payments) {
    const code = p.payment_methods?.code;
    const amt = Number(p.amount);
    if (code === POS_METHOD_CODES.CASH) cashSales += amt;
    else if (code === POS_METHOD_CODES.UPI) upiSales += amt;
    else if (code === POS_METHOD_CODES.CARD) cardSales += amt;
  }

  const totalShifts = shifts.length;
  let cashVariance = 0;
  for (const s of shifts) {
    if (s.cash_variance != null) {
      cashVariance += Number(s.cash_variance);
    }
  }

  return {
    netSales: round2(netSales),
    bills,
    units,
    avgBillValue,
    cashSales: round2(cashSales),
    upiSales: round2(upiSales),
    cardSales: round2(cardSales),
    voidedBills,
    voidedAmount: round2(voidedAmount),
    totalShifts,
    cashVariance: round2(cashVariance),
  };
}

/** Trend query with filled series */
async function computeTrend(
  range: ReportRange,
  bucket: Bucket,
  cashierId: bigint | null
): Promise<PosTrendPoint[]> {
  const key = bucketSql(Prisma.sql`o.created_at`, bucket);

  const rows = await db.$queryRaw<
    {
      bucket: string;
      bills: bigint | number;
      net: Prisma.Decimal | null;
    }[]
  >(Prisma.sql`
    SELECT ${key} AS bucket,
           COUNT(*) AS bills,
           COALESCE(SUM(o.total_amount), 0) AS net
    FROM orders o
    WHERE o.is_active = 1
      AND o.order_source = 'POS'
      AND o.order_status = 'delivered'
      AND o.created_at BETWEEN ${range.from} AND ${range.to}
      ${cashierId ? Prisma.sql`AND o.ordered_by_id = ${cashierId}` : Prisma.empty}
    GROUP BY bucket
    ORDER BY bucket
  `);

  return fillSeries(
    rows.map((r) => ({
      bucket: r.bucket,
      bills: Number(r.bills),
      netSales: num(r.net),
      cash: 0,
      upi: 0,
      card: 0,
    })),
    range,
    bucket,
    (b) => ({ bucket: b, bills: 0, netSales: 0, cash: 0, upi: 0, card: 0 })
  );
}

/** Tender modes breakdown (Cash vs UPI vs Card) */
async function computeTenderBreakdown(
  from: Date,
  to: Date,
  cashierId: bigint | null
): Promise<PosTenderRow[]> {
  const payments = await db.payment.findMany({
    where: {
      order: {
        is_active: true,
        order_source: "POS",
        order_status: "delivered",
        createdAt: inRange({ from, to }),
        ...(cashierId ? { ordered_by_id: cashierId } : {}),
      },
    },
    select: {
      amount: true,
      payment_methods: { select: { code: true } },
    },
  });

  const totals: Record<string, { label: string; bills: number; sales: number }> = {
    [POS_METHOD_CODES.CASH]: { label: "Cash", bills: 0, sales: 0 },
    [POS_METHOD_CODES.UPI]: { label: "UPI", bills: 0, sales: 0 },
    [POS_METHOD_CODES.CARD]: { label: "Card", bills: 0, sales: 0 },
  };

  let totalSales = 0;
  for (const p of payments) {
    const code = p.payment_methods?.code ?? "POS_CASH";
    const amt = Number(p.amount);
    totalSales += amt;
    if (!totals[code]) {
      totals[code] = { label: code.replace("POS_", ""), bills: 0, sales: 0 };
    }
    totals[code].bills += 1;
    totals[code].sales += amt;
  }

  return Object.entries(totals).map(([code, data]) => ({
    code,
    label: data.label,
    bills: data.bills,
    sales: round2(data.sales),
    share: totalSales > 0 ? round2((data.sales / totalSales) * 100) : 0,
    avgTicket: data.bills > 0 ? round2(data.sales / data.bills) : 0,
  }));
}

/** Cashier / staff performance audit */
async function computeCashierBreakdown(
  from: Date,
  to: Date,
  cashierId: bigint | null
): Promise<PosCashierRow[]> {
  const [orders, shifts] = await Promise.all([
    db.order.findMany({
      where: {
        is_active: true,
        order_source: "POS",
        createdAt: inRange({ from, to }),
        ...(cashierId ? { ordered_by_id: cashierId } : {}),
      },
      select: {
        ordered_by_id: true,
        totalAmount: true,
        order_status: true,
        ordered_by: { select: { name: true, email: true } },
      },
    }),
    db.pos_sessions.findMany({
      where: {
        opened_at: inRange({ from, to }),
        ...(cashierId ? { staff_user_id: cashierId } : {}),
      },
      select: {
        staff_user_id: true,
        cash_variance: true,
      },
    }),
  ]);

  const varianceByStaff = new Map<string, number>();
  for (const s of shifts) {
    const sid = String(s.staff_user_id);
    const prev = varianceByStaff.get(sid) ?? 0;
    varianceByStaff.set(sid, prev + (s.cash_variance ? Number(s.cash_variance) : 0));
  }

  type CashierStat = {
    name: string;
    email: string;
    bills: number;
    sales: number;
    voided: number;
  };
  const map = new Map<string, CashierStat>();
  let totalNetSales = 0;

  for (const o of orders) {
    const staffId = o.ordered_by_id ? String(o.ordered_by_id) : "unknown";
    const name = o.ordered_by?.name || "Staff Cashier";
    const email = o.ordered_by?.email || "";
    const isDelivered = o.order_status === "delivered";
    const isVoided = o.order_status === "cancelled";
    const amt = Number(o.totalAmount);

    if (isDelivered) {
      totalNetSales += amt;
    }

    const stat = map.get(staffId) ?? {
      name,
      email,
      bills: 0,
      sales: 0,
      voided: 0,
    };
    if (isDelivered) {
      stat.bills += 1;
      stat.sales += amt;
    }
    if (isVoided) {
      stat.voided += 1;
    }
    map.set(staffId, stat);
  }

  return Array.from(map.entries())
    .map(([id, stat]) => ({
      id,
      name: stat.name,
      email: stat.email,
      bills: stat.bills,
      netSales: round2(stat.sales),
      avgBillValue: stat.bills > 0 ? round2(stat.sales / stat.bills) : 0,
      voidedBills: stat.voided,
      cashVariance: round2(varianceByStaff.get(id) ?? 0),
      share: totalNetSales > 0 ? round2((stat.sales / totalNetSales) * 100) : 0,
    }))
    .sort((a, b) => b.netSales - a.netSales);
}

/** Hourly rush hours distribution (0 to 23 hours) */
async function computeHourlyBreakdown(
  from: Date,
  to: Date,
  cashierId: bigint | null
): Promise<PosHourRow[]> {
  const rows = await db.$queryRaw<
    { hr: number; bills: bigint | number; sales: Prisma.Decimal | null }[]
  >(Prisma.sql`
    SELECT HOUR(o.created_at) AS hr,
           COUNT(*) AS bills,
           COALESCE(SUM(o.total_amount), 0) AS sales
    FROM orders o
    WHERE o.is_active = 1
      AND o.order_source = 'POS'
      AND o.order_status = 'delivered'
      AND o.created_at BETWEEN ${from} AND ${to}
      ${cashierId ? Prisma.sql`AND o.ordered_by_id = ${cashierId}` : Prisma.empty}
    GROUP BY hr
    ORDER BY hr
  `);

  let totalSales = 0;
  const hourMap = new Map<number, { bills: number; sales: number }>();
  for (const r of rows) {
    const s = num(r.sales);
    totalSales += s;
    hourMap.set(Number(r.hr), {
      bills: Number(r.bills),
      sales: s,
    });
  }

  // Format 24-hour cycle
  const result: PosHourRow[] = [];
  for (let h = 0; h < 24; h++) {
    const data = hourMap.get(h) ?? { bills: 0, sales: 0 };
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    const label = `${displayHour}:00 ${ampm}`;

    result.push({
      hour: h,
      label,
      bills: data.bills,
      sales: round2(data.sales),
      share: totalSales > 0 ? round2((data.sales / totalSales) * 100) : 0,
    });
  }

  return result;
}

/** Best-selling products at retail counter */
async function computeTopProducts(
  from: Date,
  to: Date,
  cashierId: bigint | null
): Promise<PosProductRow[]> {
  const items = await db.orderItem.findMany({
    where: {
      is_active: true,
      order: {
        is_active: true,
        order_source: "POS",
        order_status: "delivered",
        createdAt: inRange({ from, to }),
        ...(cashierId ? { ordered_by_id: cashierId } : {}),
      },
    },
    select: {
      productId: true,
      product_name_snapshot: true,
      sku_snapshot: true,
      quantity: true,
      total_price: true,
    },
  });

  type ProductStat = { name: string; sku: string; units: number; sales: number };
  const map = new Map<string, ProductStat>();
  let totalProductSales = 0;

  for (const item of items) {
    const pid = String(item.productId);
    const amt = Number(item.total_price);
    totalProductSales += amt;

    const current = map.get(pid) ?? {
      name: item.product_name_snapshot || "In-store Item",
      sku: item.sku_snapshot || "-",
      units: 0,
      sales: 0,
    };
    current.units += item.quantity;
    current.sales += amt;
    map.set(pid, current);
  }

  return Array.from(map.entries())
    .map(([productId, stat]) => ({
      productId,
      name: stat.name,
      sku: stat.sku,
      units: stat.units,
      sales: round2(stat.sales),
      share: totalProductSales > 0 ? round2((stat.sales / totalProductSales) * 100) : 0,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10);
}

/** Recent cashier shift reconciliations */
async function computeRecentShifts(
  from: Date,
  to: Date,
  cashierId: bigint | null
): Promise<PosShiftRow[]> {
  const shifts = await db.pos_sessions.findMany({
    where: {
      opened_at: inRange({ from, to }),
      ...(cashierId ? { staff_user_id: cashierId } : {}),
    },
    select: {
      id: true,
      uuid: true,
      status: true,
      opened_at: true,
      closed_at: true,
      opening_cash: true,
      closing_cash_counted: true,
      expected_cash: true,
      cash_variance: true,
      variance_reason: true,
      staff: { select: { name: true } },
      store: { select: { name: true } },
    },
    orderBy: { opened_at: "desc" },
    take: 15,
  });

  return shifts.map((s) => ({
    id: String(s.id),
    uuid: s.uuid,
    cashierName: s.staff?.name ?? "Cashier",
    storeName: s.store?.name ?? "Main Store",
    openedAt: s.opened_at.toISOString(),
    closedAt: s.closed_at ? s.closed_at.toISOString() : null,
    openingCash: num(s.opening_cash),
    closingCash: s.closing_cash_counted != null ? num(s.closing_cash_counted) : null,
    expectedCash: s.expected_cash != null ? num(s.expected_cash) : null,
    variance: s.cash_variance != null ? num(s.cash_variance) : null,
    varianceReason: s.variance_reason,
    status: s.status,
  }));
}
