import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import { endOfDay, resolveAgentRef, startOfDay } from "./commission.queries";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CommissionReportRow {
  agentId: string;
  agentName: string;
  agentCode: string | null;
  orders: number;
  sales: number;
  pending: number;
  approved: number;
  paid: number;
  cancelledOrReversed: number;
  clawbackDue: number;
  totalEarned: number;
}

export const commissionReportService = {
  /**
   * Per-agent commission report. Orders/sales are counted from orders placed
   * in the range; commission figures from commissions created in the range.
   */
  async summary(filters: { agent?: string; dateFrom?: string; dateTo?: string }) {
    const from = filters.dateFrom ? startOfDay(filters.dateFrom) : null;
    const to = filters.dateTo ? endOfDay(filters.dateTo) : null;
    const range = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    let agentFilter: bigint | undefined;
    if (filters.agent) agentFilter = (await resolveAgentRef(filters.agent)) ?? BigInt(0);

    const commissionWhere: Prisma.commissionsWhereInput = {
      ...(agentFilter ? { agent_id: agentFilter } : {}),
      ...(range ? { created_at: range } : {}),
    };
    const orderWhere: Prisma.OrderWhereInput = {
      agent_id: agentFilter ?? { not: null },
      is_active: true,
      order_status: { notIn: ["cancelled", "returned"] },
      ...(range ? { createdAt: range } : {}),
    };

    const [commissions, orders, clawbacks] = await Promise.all([
      db.commissions.groupBy({
        by: ["agent_id", "status"],
        where: commissionWhere,
        _sum: { commission_amount: true },
      }),
      db.order.groupBy({
        by: ["agent_id"],
        where: orderWhere,
        _count: { _all: true },
        _sum: { subtotal: true },
      }),
      db.commissions.groupBy({
        by: ["agent_id"],
        where: { ...commissionWhere, clawback_due: true },
        _sum: { commission_amount: true },
      }),
    ]);

    const rows = new Map<string, CommissionReportRow>();
    const ensure = (id: bigint | null) => {
      const key = String(id);
      if (!rows.has(key)) {
        rows.set(key, {
          agentId: key,
          agentName: "",
          agentCode: null,
          orders: 0,
          sales: 0,
          pending: 0,
          approved: 0,
          paid: 0,
          cancelledOrReversed: 0,
          clawbackDue: 0,
          totalEarned: 0,
        });
      }
      return rows.get(key)!;
    };

    for (const o of orders) {
      const r = ensure(o.agent_id);
      r.orders = o._count._all;
      r.sales = Number(o._sum.subtotal ?? 0);
    }
    for (const c of commissions) {
      const r = ensure(c.agent_id);
      const amount = Number(c._sum.commission_amount ?? 0);
      if (c.status === "pending") r.pending += amount;
      else if (c.status === "paid") r.paid += amount;
      else if (c.status === "cancelled" || c.status === "reversed") r.cancelledOrReversed += amount;
      else r.approved += amount;
    }
    for (const c of clawbacks) ensure(c.agent_id).clawbackDue = Number(c._sum.commission_amount ?? 0);

    const agents = await db.user.findMany({
      where: { id: { in: [...rows.keys()].map((k) => BigInt(k)) } },
      select: { id: true, uuid: true, name: true, agent_profile: { select: { agent_code: true } } },
    });
    for (const a of agents) {
      const r = rows.get(String(a.id))!;
      r.agentId = a.uuid ?? String(a.id);
      r.agentName = a.name;
      r.agentCode = a.agent_profile?.agent_code ?? null;
    }

    const data = [...rows.values()]
      .map((r) => ({
        ...r,
        sales: round2(r.sales),
        pending: round2(r.pending),
        approved: round2(r.approved),
        paid: round2(r.paid),
        cancelledOrReversed: round2(r.cancelledOrReversed),
        clawbackDue: round2(r.clawbackDue),
        totalEarned: round2(r.pending + r.approved + r.paid),
      }))
      .sort((a, b) => b.totalEarned - a.totalEarned);

    const totals = data.reduce(
      (t, r) => ({
        orders: t.orders + r.orders,
        sales: round2(t.sales + r.sales),
        pending: round2(t.pending + r.pending),
        approved: round2(t.approved + r.approved),
        paid: round2(t.paid + r.paid),
        cancelledOrReversed: round2(t.cancelledOrReversed + r.cancelledOrReversed),
        clawbackDue: round2(t.clawbackDue + r.clawbackDue),
        totalEarned: round2(t.totalEarned + r.totalEarned),
      }),
      { orders: 0, sales: 0, pending: 0, approved: 0, paid: 0, cancelledOrReversed: 0, clawbackDue: 0, totalEarned: 0 }
    );

    return { data, totals };
  },
};
