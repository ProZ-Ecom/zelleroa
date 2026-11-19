"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe, Store } from "lucide-react";
import { formatPrice, formatDate, cn } from "@/lib/utils";
import type { DashboardChannel } from "@/features/dashboard/api/get-stats";

interface DummyOrder {
  id: string;
  uuid?: string | null;
  customer: string;
  date: string;
  amount: number;
  status: string;
  source?: string | null;
}

/** [text, background, dot] per order status. */
const STATUS_STYLES: Record<string, [string, string, string]> = {
  pending: ["#92400e", "#fffbeb", "#f59e0b"],
  confirmed: ["#1d4ed8", "#eff6ff", "#3b82f6"],
  processing: ["#4338ca", "#eef2ff", "#6366f1"],
  packed: ["#0e7490", "#ecfeff", "#06b6d4"],
  shipped: ["#6d28d9", "#f5f3ff", "#8b5cf6"],
  out_for_delivery: ["#a21caf", "#fdf4ff", "#d946ef"],
  delivered: ["#15803d", "#f0fdf4", "#22c55e"],
  cancelled: ["#b91c1c", "#fef2f2", "#ef4444"],
  returned: ["#475569", "#f1f5f9", "#64748b"],
};

function StatusPill({ status }: { status: string }) {
  const [text, bg, dot] = STATUS_STYLES[status] ?? STATUS_STYLES.returned;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
      style={{ color: text, background: bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

interface RecentOrdersProps {
  orders: DummyOrder[];
  channel?: DashboardChannel;
}

function RecentOrders({ orders, channel = "all" }: RecentOrdersProps) {
  const [tab, setTab] = useState<"all" | "online" | "pos">("all");

  const onlineOrders = orders.filter((o) => o.source !== "POS");
  const posOrders = orders.filter((o) => o.source === "POS");

  const effectiveTab: "all" | "online" | "pos" =
    channel === "online" ? "online" : channel === "pos" ? "pos" : tab;

  const displayedOrders =
    channel === "online"
      ? orders
      : channel === "pos"
      ? orders
      : effectiveTab === "online"
      ? onlineOrders
      : effectiveTab === "pos"
      ? posOrders
      : orders;

  const viewAllHref =
    effectiveTab === "pos" ? "/admin/dashboard/orders/pos" : "/admin/dashboard/orders";
  const viewAllLabel =
    effectiveTab === "pos"
      ? "View all POS sales"
      : effectiveTab === "online"
      ? "View all online orders"
      : "View all";

  const cardTitle =
    channel === "online"
      ? "Recent Online Orders"
      : channel === "pos"
      ? "Recent POS Counter Sales"
      : "Recent Orders & Counter Sales";

  return (
    <div className="rounded-2xl border border-[var(--color-neutral-200)]/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-[var(--color-neutral-900)]">
            {cardTitle}
          </h3>

          {/* Tab switcher: show all three tabs in "all" dashboard tab; show only the related tab in "online" or "pos" dashboard tab */}
          {channel === "all" ? (
            <div className="inline-flex items-center rounded-xl bg-neutral-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTab("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition-all",
                  tab === "all"
                    ? "bg-white text-neutral-900 shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                All ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("online")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition-all",
                  tab === "online"
                    ? "bg-white text-sky-700 shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                <Globe className="h-3 w-3" />
                Online ({onlineOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("pos")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition-all",
                  tab === "pos"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                <Store className="h-3 w-3" />
                POS ({posOrders.length})
              </button>
            </div>
          ) : channel === "online" ? (
            <div className="inline-flex items-center rounded-xl bg-neutral-100 p-0.5 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-sky-700 shadow-xs">
                <Globe className="h-3 w-3" />
                Online ({orders.length})
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center rounded-xl bg-neutral-100 p-0.5 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-emerald-700 shadow-xs">
                <Store className="h-3 w-3" />
                POS ({orders.length})
              </span>
            </div>
          )}
        </div>

        <Link
          href={viewAllHref}
          className="text-xs sm:text-sm font-semibold text-[var(--color-primary-600)] hover:underline"
        >
          {viewAllLabel} &rarr;
        </Link>
      </div>

      {displayedOrders.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--color-neutral-400)]">
          No {effectiveTab === "pos" ? "counter sales" : effectiveTab === "online" ? "online orders" : "orders"} yet
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="rounded-lg bg-[var(--color-neutral-50)] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-neutral-500)]">
                <th className="rounded-l-lg px-3 py-2.5">Order</th>
                <th className="px-3 py-2.5">Channel</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="rounded-r-lg px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.map((order) => {
                const isPos = order.source === "POS";
                return (
                  <tr
                    key={order.id}
                    className="border-b border-[var(--color-neutral-100)] transition-colors last:border-0 hover:bg-[var(--color-neutral-50)]"
                  >
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-[var(--color-neutral-900)]">
                      {order.id}
                    </td>
                    <td className="px-3 py-3">
                      {isPos ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 border border-emerald-200">
                          <Store className="h-3 w-3 text-emerald-600" />
                          POS Counter
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[10.5px] font-bold text-sky-700 border border-sky-200">
                          <Globe className="h-3 w-3 text-sky-600" />
                          Online
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{
                            backgroundImage: isPos
                              ? "linear-gradient(135deg, #059669, #047857)"
                              : "linear-gradient(135deg, var(--primary-500), var(--primary-700))",
                          }}
                        >
                          {(order.customer || "C").charAt(0).toUpperCase()}
                        </span>
                        <span className="text-[var(--color-neutral-800)] font-medium">
                          {order.customer || (isPos ? "Walk-in Customer" : "Customer")}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-neutral-500)] text-xs">
                      {formatDate(order.date)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-[var(--color-neutral-900)] tabular-nums">
                      {formatPrice(order.amount)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={order.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { RecentOrders };
export type { DummyOrder };
