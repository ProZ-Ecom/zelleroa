"use client";

import { useDashboardStats } from "@/features/dashboard/hooks";
import { useAdminOrdersCount } from "@/features/orders/hooks";
import { formatPrice } from "@/lib/utils";

export function OrderStatsCards() {
  const { data: stats, isLoading: isStatsLoading } = useDashboardStats();
  const { data: orderCounts, isLoading: isCountsLoading } = useAdminOrdersCount();

  const todayOrders = orderCounts?.todayOrders ?? stats?.todayOrders ?? 0;
  const pendingOrders = orderCounts?.pending ?? stats?.pendingOrders ?? 0;
  const totalOrders = orderCounts?.total ?? stats?.totalOrders ?? 0;
  const totalRevenue = orderCounts?.totalRevenue ?? stats?.totalRevenue ?? 0;

  const cards = [
    {
      label: "TODAY'S ORDERS",
      value: isStatsLoading ? "—" : String(todayOrders),
      note: "Orders placed today",
      noteColor: "text-neutral-500",
      accentBorder: "border-l-amber-600",
    },
    {
      label: "AWAITING CONFIRMATION",
      value: isCountsLoading && isStatsLoading ? "—" : String(pendingOrders),
      note: pendingOrders > 0 ? "Needs action" : "All clear",
      noteColor: pendingOrders > 0 ? "text-amber-700 font-semibold" : "text-neutral-500",
      accentBorder: "border-l-primary-500",
    },
    {
      label: "TOTAL ORDERS",
      value: isCountsLoading && isStatsLoading ? "—" : String(totalOrders),
      note: "All-time total orders",
      noteColor: "text-neutral-500",
      accentBorder: "border-l-secondary-600",
    },
    {
      label: "ORDER VALUE",
      value: isStatsLoading ? "—" : formatPrice(totalRevenue),
      note: "Total order revenue",
      noteColor: "text-neutral-500",
      accentBorder: "border-l-success-600",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`flex flex-col gap-1 rounded-xl border border-cream-border bg-white p-3 shadow-xs border-l-[3px] ${card.accentBorder}`}
        >
          <div className="text-[10.5px] font-bold tracking-wider text-neutral-400 uppercase">
            {card.label}
          </div>
          <div className="text-xl font-bold tracking-tight text-neutral-900">
            {card.value}
          </div>
          <div className={`text-[11px] font-medium ${card.noteColor}`}>
            {card.note}
          </div>
        </div>
      ))}
    </section>
  );
}
