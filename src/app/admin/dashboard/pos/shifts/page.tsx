"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { Pagination } from "@/components/ui/pagination";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { useShifts } from "@/features/pos/hooks/use-pos";

/**
 * Shift report.
 *
 * One row per cashier shift with the variance spelled out, because that column
 * is the whole reason the shift exists: a drawer that is consistently short
 * points at a person and a period, which a single daily total never could.
 */
export default function PosShiftsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useShifts({ page, limit: 20 });

  const rows = data?.data ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <AdminPageHeader
        title="Counter shifts"
        description="Every cashier shift, what it took, and whether the cash matched."
      />

      <div className="mt-6 pb-6">
        {isLoading && !data ? (
          <AdminTableSkeleton />
        ) : rows.length === 0 ? (
          <p className="rounded-2xl bg-white p-10 text-center text-sm text-neutral-500">
            No shifts yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-100 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Opened</th>
                  <th className="px-4 py-3">Closed</th>
                  <th className="px-4 py-3 text-right">Bills</th>
                  <th className="px-4 py-3 text-right">Net sales</th>
                  <th className="px-4 py-3 text-right">Cash</th>
                  <th className="px-4 py-3 text-right">UPI</th>
                  <th className="px-4 py-3 text-right">Card</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const variance = row.session.cashVariance;
                  return (
                    <tr key={row.session.uuid} className="border-b border-neutral-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900">{row.session.staffName}</p>
                        <p className="text-xs text-neutral-500">{row.session.storeName}</p>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDateTime(row.session.openedAt)}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {row.session.closedAt ? (
                          formatDateTime(row.session.closedAt)
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.billCount}
                        {row.voidedCount > 0 && (
                          <span className="ml-1 text-xs text-amber-600">
                            ({row.voidedCount} void)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPrice(row.netSales)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPrice(row.cash)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPrice(row.upi)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPrice(row.card)}</td>
                      <td className="px-4 py-3 text-right">
                        {variance === null ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          <span
                            className={cn(
                              "tabular-nums font-medium",
                              variance === 0
                                ? "text-emerald-700"
                                : variance < 0
                                  ? "text-red-600"
                                  : "text-amber-600"
                            )}
                            title={row.session.varianceReason ?? undefined}
                          >
                            {variance === 0
                              ? "Balanced"
                              : `${variance < 0 ? "Short" : "Over"} ${formatPrice(Math.abs(variance))}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(data?.meta?.totalPages ?? 1) > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={data?.meta?.totalPages ?? 1}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
