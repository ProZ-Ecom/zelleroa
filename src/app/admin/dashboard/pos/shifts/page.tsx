"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  Clock,
  RefreshCw,
  Store,
  Wallet,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/admin/data-table/TablePagination";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { useShifts } from "@/features/pos/hooks/use-pos";

type DatePreset = "all" | "today" | "yesterday" | "7d" | "month" | "custom";

const SHIFT_STATUS_OPTIONS: SelectOption[] = [
  { value: "ALL", label: "All Shifts" },
  { value: "OPEN", label: "Open Shifts only" },
  { value: "CLOSED", label: "Closed Shifts only" },
];

/**
 * Shift report.
 *
 * One row per cashier shift with the variance spelled out, because that column
 * is the whole reason the shift exists: a drawer that is consistently short
 * points at a person and a period, which a single daily total never could.
 */
export default function PosShiftsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === "today") {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === "7d") {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      setFromDate(d7.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else if (preset === "month") {
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(mStart.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else if (preset === "all") {
      setFromDate("");
      setToDate("");
    }
    setPage(1);
  };

  const queryParams = useMemo(() => {
    return {
      page,
      limit: pageSize,
      status: status !== "ALL" ? status : undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    };
  }, [page, pageSize, status, fromDate, toDate]);

  const { data, isLoading, refetch, isFetching } = useShifts(queryParams);

  const rows = useMemo(() => data?.data ?? [], [data?.data]);

  // Compute quick metrics across fetched shifts
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalCash = 0;
    let openCount = 0;
    let shortCount = 0;

    for (const r of rows) {
      totalSales += r.netSales;
      totalCash += r.cash;
      if (r.session.status === "OPEN") openCount++;
      if (r.session.cashVariance !== null && r.session.cashVariance < 0) shortCount++;
    }

    return { totalSales, totalCash, openCount, shortCount };
  }, [rows]);

  return (
    <div className="flex flex-1 flex-col overflow-auto space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Counter shifts"
        description="Every cashier shift, what it took, and whether the cash matched."
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Counter (POS)", href: "/admin/dashboard/pos" },
          { label: "Shifts" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </Button>
            <Link href="/admin/dashboard/pos">
              <Button size="sm" className="gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800 text-xs">
                <Store className="h-3.5 w-3.5" />
                Go to Billing
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        {/* Total Shifts */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500">Total Shifts</p>
            <Wallet className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {data?.meta?.total ?? rows.length}
          </p>
          <div className="mt-2 text-xs text-neutral-500">
            {metrics.openCount > 0 ? (
              <span className="font-semibold text-emerald-700">{metrics.openCount} currently open</span>
            ) : (
              <span>All shifts closed</span>
            )}
          </div>
        </div>

        {/* Shift Net Sales */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500">Shift Net Sales</p>
            <Store className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatPrice(metrics.totalSales)}
          </p>
          <p className="mt-2 text-xs text-neutral-400">Total revenue across shifts</p>
        </div>

        {/* Shift Drawer Cash */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500">Drawer Cash</p>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatPrice(metrics.totalCash)}
          </p>
          <p className="mt-2 text-xs text-neutral-400">Physical drawer cash takings</p>
        </div>

        {/* Shift Discrepancies */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500">Reconciliation</p>
            <CheckCircle2 className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {metrics.shortCount > 0 ? `${metrics.shortCount} Short` : "Balanced"}
          </p>
          <p className="mt-2 text-xs text-neutral-400">Cash variance audits</p>
        </div>
      </div>

      {/* Filter Bar with Standard Select Dropdown */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { label: "Today", value: "today" },
                { label: "Yesterday", value: "yesterday" },
                { label: "Last 7 Days", value: "7d" },
                { label: "This Month", value: "month" },
                { label: "All Time", value: "all" },
                { label: "Custom", value: "custom" },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                onClick={() => handlePresetChange(item.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  datePreset === item.value
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Status Dropdown using standard Select UI component */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-neutral-500 text-xs font-medium shrink-0">Status:</span>
            <div className="w-full sm:w-44">
              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val as "ALL" | "OPEN" | "CLOSED");
                  setPage(1);
                }}
                options={SHIFT_STATUS_OPTIONS}
                searchable={false}
                size="sm"
                className="h-9 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Custom Date Range Pickers (only shown when custom preset is selected) */}
        {datePreset === "custom" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 text-xs">
            <span className="text-neutral-500 font-medium">From:</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="h-9 w-32 sm:w-36 text-xs"
            />
            <span className="text-neutral-500 font-medium">To:</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="h-9 w-32 sm:w-36 text-xs"
            />
          </div>
        )}
      </div>

      {/* Responsive Shifts Data Table */}
      <div className="rounded-2xl border border-cream-border bg-white shadow-xs overflow-hidden">
        {isLoading && !data ? (
          <div className="p-6">
            <AdminTableSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Wallet className="h-10 w-10 text-neutral-300 mb-2" />
            <p className="text-base font-semibold text-neutral-900">No shifts found</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm">
              No cashier shifts match your selected status and date range. Try broadening the filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-table">
            <table className="w-full min-w-[900px] table-auto caption-bottom text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-stone-900 text-[#D4AF37] border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                <tr>
                  <th className="h-12 px-4 sm:px-5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Cashier
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Opened
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Closed
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-right align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Bills
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-right align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Net Sales
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-right align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Cash
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-right align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    UPI
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-right align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Card
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-right align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((row) => {
                  const variance = row.session.cashVariance;
                  return (
                    <tr key={row.session.uuid} className="group hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3.5 sm:px-5 whitespace-nowrap border-b border-neutral-100">
                        <p className="font-semibold text-neutral-900">{row.session.staffName}</p>
                        <p className="text-[11px] text-neutral-400">{row.session.storeName}</p>
                      </td>
                      <td className="px-4 py-3.5 sm:px-5 text-neutral-600 whitespace-nowrap text-xs border-b border-neutral-100">
                        {formatDateTime(row.session.openedAt)}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5 text-neutral-600 whitespace-nowrap text-xs border-b border-neutral-100">
                        {row.session.closedAt ? (
                          formatDateTime(row.session.closedAt)
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            <Clock className="h-3 w-3 animate-pulse" />
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5 text-right tabular-nums whitespace-nowrap font-medium border-b border-neutral-100">
                        {row.billCount}
                        {row.voidedCount > 0 && (
                          <span className="ml-1 text-xs text-amber-600">
                            ({row.voidedCount} void)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5 text-right tabular-nums whitespace-nowrap font-bold text-neutral-900 border-b border-neutral-100">
                        {formatPrice(row.netSales)}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5 text-right tabular-nums whitespace-nowrap text-neutral-700 border-b border-neutral-100">
                        {formatPrice(row.cash)}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5 text-right tabular-nums whitespace-nowrap text-neutral-700 border-b border-neutral-100">
                        {formatPrice(row.upi)}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5 text-right tabular-nums whitespace-nowrap text-neutral-700 border-b border-neutral-100">
                        {formatPrice(row.card)}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5 text-right whitespace-nowrap border-b border-neutral-100">
                        {variance === null ? (
                          <span className="text-neutral-400 font-mono">—</span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                              variance === 0
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                                : variance < 0
                                  ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
                                  : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
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

        {/* Standard Table Pagination */}
        <TablePagination
          page={page}
          totalPages={data?.meta?.totalPages ?? 1}
          total={data?.meta?.total ?? rows.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 30, 50]}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
