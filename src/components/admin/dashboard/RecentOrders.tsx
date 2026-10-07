"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/utils";

interface DummyOrder {
  id: string;
  customer: string;
  date: string;
  amount: number;
  status: string;
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
}

function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-neutral-200)]/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--color-neutral-900)]">Recent Orders</h3>
        <Link
          href="/admin/dashboard/orders"
          className="text-sm font-medium text-[var(--color-primary-600)] hover:underline"
        >
          View all
        </Link>
      </div>

      {orders.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--color-neutral-400)]">No orders yet</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="rounded-lg bg-[var(--color-neutral-50)] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-neutral-500)]">
              <th className="rounded-l-lg px-3 py-2.5">Order</th>
              <th className="px-3 py-2.5">Customer</th>
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5 text-right">Amount</th>
              <th className="rounded-r-lg px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-[var(--color-neutral-100)] transition-colors last:border-0 hover:bg-[var(--color-neutral-50)]"
              >
                <td className="px-3 py-3 font-mono text-xs font-medium text-[var(--color-neutral-900)]">
                  {order.id}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{
                        backgroundImage:
                          "linear-gradient(135deg, var(--primary-500), var(--primary-700))",
                      }}
                    >
                      {order.customer.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[var(--color-neutral-800)]">{order.customer}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-[var(--color-neutral-500)]">
                  {new Date(order.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-[var(--color-neutral-900)] tabular-nums">
                  {formatPrice(order.amount)}
                </td>
                <td className="px-3 py-3">
                  <StatusPill status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { RecentOrders };
export type { DummyOrder };
