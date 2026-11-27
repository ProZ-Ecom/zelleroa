"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Eye,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  Store,
  X,
  XCircle,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/admin/data-table/TablePagination";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { usePurchases } from "@/features/pos/hooks/use-pos";
import * as api from "@/features/pos/api/pos.api";
import { printReceipt } from "@/features/pos/components/PosReceipt";
import { PosPurchaseDetailModal } from "@/features/pos/components/PosPurchaseDetailModal";
import type { PosPaymentMode } from "@/features/pos/types";

const PAYMENT_ICONS: Record<PosPaymentMode, typeof Banknote> = {
  CASH: Banknote,
  UPI: Smartphone,
  CARD: CreditCard,
};

const PAYMENT_MODE_OPTIONS: SelectOption[] = [
  { value: "ALL", label: "All Tenders" },
  { value: "CASH", label: "Cash only" },
  { value: "UPI", label: "UPI only" },
  { value: "CARD", label: "Card only" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "delivered", label: "Completed only" },
  { value: "cancelled", label: "Voided only" },
];

type DatePreset = "all" | "today" | "yesterday" | "7d" | "month" | "custom";

export interface PosSalesViewProps {
  showHeader?: boolean;
}

export function PosSalesView({ showHeader = false }: PosSalesViewProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<PosPaymentMode | "ALL">("ALL");
  const [status, setStatus] = useState<"all" | "delivered" | "cancelled">("all");

  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [isSelectedVoided, setIsSelectedVoided] = useState(false);
  const [printingUuid, setPrintingUuid] = useState<string | null>(null);

  // Apply Date preset logic
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
      search: search.trim() || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      paymentMode: paymentMode !== "ALL" ? paymentMode : undefined,
      status: status !== "all" ? status : undefined,
    };
  }, [page, pageSize, search, fromDate, toDate, paymentMode, status]);

  const { data, isLoading, refetch, isFetching } = usePurchases(queryParams);

  const rows = data?.data ?? [];
  const summary = data?.summary ?? {
    totalCount: 0,
    deliveredCount: 0,
    voidedCount: 0,
    grossSales: 0,
    netSales: 0,
    cashSales: 0,
    upiSales: 0,
    cardSales: 0,
  };

  const handleQuickPrint = async (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation();
    setPrintingUuid(uuid);
    try {
      const detail = await api.getPurchaseDetail(uuid);
      printReceipt(detail);
    } catch {
      // handled
    } finally {
      setPrintingUuid(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col space-y-4">
      {/* Header if requested */}
      {showHeader && (
        <AdminPageHeader
          title="Counter Purchases"
          description="All completed counter sales, receipts, tender breakdown, and transaction history."
          breadcrumbs={[
            { label: "Dashboard", href: "/admin/dashboard" },
            { label: "Counter (POS)", href: "/admin/dashboard/pos" },
            { label: "Purchases" },
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
      )}

      {/* POS Metric Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {/* Gross Sales */}
        <div className="flex flex-col gap-1 rounded-xl border border-cream-border bg-white p-3 shadow-xs border-l-[3px] border-l-secondary-600">
          <div className="text-[10.5px] font-bold tracking-wider text-neutral-400 uppercase">
            Gross Counter Sales
          </div>
          <div className="text-xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatPrice(summary.grossSales)}
          </div>
          <div className="text-[11px] font-medium text-neutral-500">
            {summary.deliveredCount} bills {summary.voidedCount > 0 ? `(${summary.voidedCount} voided)` : ""}
          </div>
        </div>

        {/* Cash Sales */}
        <div className="flex flex-col gap-1 rounded-xl border border-cream-border bg-white p-3 shadow-xs border-l-[3px] border-l-emerald-600">
          <div className="text-[10.5px] font-bold tracking-wider text-neutral-400 uppercase flex items-center justify-between">
            <span>Cash Collected</span>
            <Banknote className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatPrice(summary.cashSales)}
          </div>
          <div className="text-[11px] font-medium text-neutral-500">
            Physical drawer cash
          </div>
        </div>

        {/* UPI Sales */}
        <div className="flex flex-col gap-1 rounded-xl border border-cream-border bg-white p-3 shadow-xs border-l-[3px] border-l-sky-600">
          <div className="text-[10.5px] font-bold tracking-wider text-neutral-400 uppercase flex items-center justify-between">
            <span>UPI Payments</span>
            <Smartphone className="h-3.5 w-3.5 text-sky-600" />
          </div>
          <div className="text-xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatPrice(summary.upiSales)}
          </div>
          <div className="text-[11px] font-medium text-neutral-500">
            QR / VPA settlements
          </div>
        </div>

        {/* Card Sales */}
        <div className="flex flex-col gap-1 rounded-xl border border-cream-border bg-white p-3 shadow-xs border-l-[3px] border-l-indigo-600">
          <div className="text-[10.5px] font-bold tracking-wider text-neutral-400 uppercase flex items-center justify-between">
            <span>Card Swipes</span>
            <CreditCard className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatPrice(summary.cardSales)}
          </div>
          <div className="text-[11px] font-medium text-neutral-500">
            POS machine receipts
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search invoice #, order #, customer phone/name, SKU..."
              className="pl-9 text-xs h-9"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

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
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  datePreset === item.value
                    ? "bg-stone-900 text-[#D4AF37] shadow-xs"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary filters (Custom Date Range, Payment Mode, Status) */}
        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-xs">
          {datePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
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

          {/* Payment Mode */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-neutral-500 font-medium shrink-0">Tender:</span>
            <div className="w-full sm:w-36">
              <Select
                value={paymentMode}
                onValueChange={(val) => {
                  setPaymentMode(val as PosPaymentMode | "ALL");
                  setPage(1);
                }}
                options={PAYMENT_MODE_OPTIONS}
                searchable={false}
                size="sm"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-neutral-500 font-medium shrink-0">Status:</span>
            <div className="w-full sm:w-36">
              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val as "all" | "delivered" | "cancelled");
                  setPage(1);
                }}
                options={STATUS_OPTIONS}
                searchable={false}
                size="sm"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5 text-xs h-9"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* POS Data Table */}
      <div className="rounded-2xl border border-cream-border bg-white shadow-xs overflow-hidden">
        {isLoading && !data ? (
          <div className="p-6">
            <AdminTableSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <ShoppingBag className="h-10 w-10 text-neutral-300 mb-2" />
            <p className="text-base font-semibold text-neutral-900">No counter sales found</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm">
              No counter sales match your selected filters. Try broadening the date range or clearing search filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-table">
            <table className="w-full min-w-full table-auto caption-bottom text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-stone-900 text-[#D4AF37] border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                <tr>
                  <th className="h-12 px-4 sm:px-5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Date & Time
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Bill / Invoice
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Customer
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Items
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Tender
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Cashier
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-center align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Status
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-right align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Total
                  </th>
                  <th className="h-12 px-4 sm:px-5 text-right align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-[#D4AF37] bg-stone-900 border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((row) => {
                  const PaymentIcon = PAYMENT_ICONS[row.paymentMode] || Banknote;
                  return (
                    <tr
                      key={row.orderUuid || row.orderNumber}
                      onClick={() => {
                        setSelectedUuid(row.orderUuid);
                        setIsSelectedVoided(row.status === "cancelled");
                      }}
                      className={cn(
                        "group cursor-pointer hover:bg-neutral-50/80 transition-colors",
                        row.status === "cancelled" && "bg-red-50/20"
                      )}
                    >
                      <td className="px-4 py-3.5 sm:px-5 text-neutral-600 whitespace-nowrap border-b border-neutral-100">
                        {formatDateTime(row.placedAt)}
                      </td>

                      <td className="px-4 py-3.5 sm:px-5 border-b border-neutral-100">
                        <p className="font-bold text-neutral-900">
                          {row.invoiceNumber || row.orderNumber}
                        </p>
                        <p className="font-mono text-[10px] text-neutral-400">
                          {row.orderNumber}
                        </p>
                      </td>

                      <td className="px-4 py-3.5 sm:px-5 border-b border-neutral-100">
                        <p className="font-medium text-neutral-900">
                          {row.customerName || "Walk-in Customer"}
                        </p>
                        {row.customerPhone && (
                          <p className="text-[11px] text-neutral-500">{row.customerPhone}</p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 sm:px-5 max-w-xs border-b border-neutral-100">
                        <p className="font-medium text-neutral-800">
                          {row.itemCount} {row.itemCount === 1 ? "item" : "items"}
                        </p>
                        <p className="text-[11px] text-neutral-400 truncate" title={row.itemsSummary}>
                          {row.itemsSummary}
                        </p>
                      </td>

                      <td className="px-4 py-3.5 sm:px-5 whitespace-nowrap border-b border-neutral-100">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                          <PaymentIcon className="h-3.5 w-3.5 text-neutral-600" />
                          {row.paymentMode}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 sm:px-5 whitespace-nowrap text-neutral-600 border-b border-neutral-100">
                        {row.cashierName}
                      </td>

                      <td className="px-4 py-3.5 sm:px-5 text-center whitespace-nowrap border-b border-neutral-100">
                        {row.status === "cancelled" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                            <XCircle className="h-3 w-3" />
                            Voided
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            Delivered
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 sm:px-5 text-right tabular-nums whitespace-nowrap border-b border-neutral-100">
                        <span
                          className={cn(
                            "text-sm font-bold",
                            row.status === "cancelled" ? "line-through text-neutral-400" : "text-neutral-900"
                          )}
                        >
                          {formatPrice(row.totalAmount)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 sm:px-5 text-right whitespace-nowrap border-b border-neutral-100">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-neutral-600 hover:bg-neutral-100 rounded-lg"
                            title="Print receipt"
                            onClick={(e) => handleQuickPrint(e, row.orderUuid)}
                            disabled={printingUuid === row.orderUuid}
                          >
                            {printingUuid === row.orderUuid ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Printer className="h-3.5 w-3.5" />
                            )}
                          </Button>

                          <Link
                            href={`/invoice/${row.orderUuid}`}
                            target="_blank"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg p-0 text-neutral-600 hover:bg-neutral-100"
                            title="Tax Invoice"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-neutral-600 hover:bg-neutral-100 rounded-lg"
                            title="View details"
                            onClick={() => {
                              setSelectedUuid(row.orderUuid);
                              setIsSelectedVoided(row.status === "cancelled");
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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

      {/* Detailed Bill Modal */}
      {selectedUuid && (
        <PosPurchaseDetailModal
          open={Boolean(selectedUuid)}
          orderUuid={selectedUuid}
          isVoided={isSelectedVoided}
          onClose={() => setSelectedUuid(null)}
          onVoidSuccess={() => {
            void refetch();
          }}
        />
      )}
    </div>
  );
}

