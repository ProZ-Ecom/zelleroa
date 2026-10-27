"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Info } from "lucide-react";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ClearFiltersButton } from "@/components/common/clear-filters-button";
import { ExportButton } from "@/components/common/export-button";
import { exportDataToCsv } from "@/lib/export-csv";
import { useSalesMargin, useStockValuation } from "@/features/inventory/hooks/use-valuation";
import type {
  SalesMarginRow,
  ValuationGroupBy,
  ValuationRow,
} from "@/features/inventory/types/valuation";
import { useBrands } from "@/features/brands/hooks";
import { useCategories } from "@/features/categories/hooks";

type View = "stock" | "sales";

const money = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;

function MarginCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[var(--color-neutral-400)]">—</span>;
  const tone = value < 0 ? "text-red-600" : value < 10 ? "text-amber-600" : "text-emerald-600";
  return <span className={`tabular-nums font-semibold ${tone}`}>{value.toFixed(1)}%</span>;
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-3">
      <p className="text-xs font-medium text-[var(--color-neutral-500)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--color-neutral-900)]">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--color-neutral-400)]">{hint}</p>}
    </div>
  );
}

export default function ValuationPage() {
  const [view, setView] = useState<View>("stock");
  const [groupBy, setGroupBy] = useState<ValuationGroupBy>("category");
  const [categorySlug, setCategorySlug] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const filters = { groupBy, categorySlug: categorySlug || undefined, brandSlug: brandSlug || undefined };
  const stock = useStockValuation(filters, view === "stock");
  const sales = useSalesMargin({ ...filters, from, to }, view === "sales");

  const { data: categoryData } = useCategories({ page: 1, pageSize: 200 });
  const { data: brandData } = useBrands({ page: 1, limit: 100 });

  const active = view === "stock" ? stock : sales;
  const hasFilters = !!categorySlug || !!brandSlug;

  const stockColumns: ColumnDef<ValuationRow>[] = [
    { id: "name", header: groupBy === "category" ? "Category" : "Brand", accessorFn: (r) => r.name },
    {
      id: "skus",
      header: "SKUs",
      accessorFn: (r) => r.skuCount,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.skuCount}
          {row.original.unvaluedSkus > 0 && (
            <span className="ml-1.5 text-[11px] font-medium text-amber-600">
              ({row.original.unvaluedSkus} unvalued)
            </span>
          )}
        </span>
      ),
    },
    {
      id: "units",
      header: "Units",
      accessorFn: (r) => r.units,
      cell: ({ row }) => <span className="tabular-nums">{row.original.units}</span>,
    },
    {
      id: "cost",
      header: "Stock at cost",
      accessorFn: (r) => r.costValue,
      cell: ({ row }) => <span className="tabular-nums">{money(row.original.costValue)}</span>,
    },
    {
      id: "retail",
      header: "At retail",
      accessorFn: (r) => r.retailValue,
      cell: ({ row }) => <span className="tabular-nums">{money(row.original.retailValue)}</span>,
    },
    {
      id: "profit",
      header: "Potential profit",
      accessorFn: (r) => r.potentialProfit,
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">{money(row.original.potentialProfit)}</span>
      ),
    },
    {
      id: "margin",
      header: "Margin",
      accessorFn: (r) => r.marginPercent ?? -999,
      cell: ({ row }) => <MarginCell value={row.original.marginPercent} />,
    },
  ];

  const salesColumns: ColumnDef<SalesMarginRow>[] = [
    { id: "name", header: groupBy === "category" ? "Category" : "Brand", accessorFn: (r) => r.name },
    {
      id: "orders",
      header: "Orders",
      accessorFn: (r) => r.orderCount,
      cell: ({ row }) => <span className="tabular-nums">{row.original.orderCount}</span>,
    },
    {
      id: "units",
      header: "Units sold",
      accessorFn: (r) => r.unitsSold,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.unitsSold}
          {row.original.unitsWithoutCost > 0 && (
            <span className="ml-1.5 text-[11px] font-medium text-amber-600">
              ({row.original.unitsWithoutCost} uncosted)
            </span>
          )}
        </span>
      ),
    },
    {
      id: "revenue",
      header: "Revenue",
      accessorFn: (r) => r.revenue,
      cell: ({ row }) => <span className="tabular-nums">{money(row.original.revenue)}</span>,
    },
    {
      id: "cost",
      header: "Est. cost",
      accessorFn: (r) => r.estimatedCost,
      cell: ({ row }) => <span className="tabular-nums">{money(row.original.estimatedCost)}</span>,
    },
    {
      id: "profit",
      header: "Est. profit",
      accessorFn: (r) => r.estimatedProfit,
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">{money(row.original.estimatedProfit)}</span>
      ),
    },
    {
      id: "margin",
      header: "Margin",
      accessorFn: (r) => r.marginPercent ?? -999,
      cell: ({ row }) => <MarginCell value={row.original.marginPercent} />,
    },
  ];

  if (active.error) {
    return <ErrorState message="Failed to load the report" onRetry={() => active.refetch()} />;
  }

  const stockTotals = stock.data?.totals;
  const salesTotals = sales.data?.totals;

  const exportRows = () =>
    view === "stock"
      ? exportDataToCsv(
          (stock.data?.rows ?? []).map((r) => ({
            [groupBy === "category" ? "Category" : "Brand"]: r.name,
            SKUs: r.skuCount,
            "Unvalued SKUs": r.unvaluedSkus,
            Units: r.units,
            "Stock at cost": r.costValue,
            "At retail": r.retailValue,
            "Potential profit": r.potentialProfit,
            "Margin %": r.marginPercent ?? "",
          })),
          "stock-valuation"
        )
      : exportDataToCsv(
          (sales.data?.rows ?? []).map((r) => ({
            [groupBy === "category" ? "Category" : "Brand"]: r.name,
            Orders: r.orderCount,
            "Units sold": r.unitsSold,
            "Uncosted units": r.unitsWithoutCost,
            "Estimated units": r.unitsEstimated,
            Revenue: r.revenue,
            "Estimated cost": r.estimatedCost,
            "Estimated profit": r.estimatedProfit,
            "Margin %": r.marginPercent ?? "",
          })),
          `sales-margin-${from}-to-${to}`
        );

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Valuation & Margin"
        description="What the stock on hand is worth, and what the sales actually made."
      />

      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden py-1">
          <div className="flex-shrink-0 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg border border-[var(--color-neutral-200)] bg-white p-0.5">
                  {(
                    [
                      ["stock", "Stock valuation"],
                      ["sales", "Sales margin"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setView(value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        view === value
                          ? "bg-[var(--color-neutral-900)] text-white"
                          : "text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <Select
                  value={groupBy}
                  onValueChange={(v) => setGroupBy(v as ValuationGroupBy)}
                  options={[
                    { value: "category", label: "By category" },
                    { value: "brand", label: "By brand" },
                  ]}
                  className="w-40"
                  aria-label="Group rows by"
                />
                <Select
                  value={categorySlug}
                  onValueChange={setCategorySlug}
                  options={[
                    { value: "", label: "All categories" },
                    ...(categoryData?.data ?? []).map((c) => ({ value: c.slug, label: c.name })),
                  ]}
                  className="w-44"
                  aria-label="Filter by category"
                />
                <Select
                  value={brandSlug}
                  onValueChange={setBrandSlug}
                  options={[
                    { value: "", label: "All brands" },
                    ...(brandData?.data ?? []).map((b) => ({ value: b.slug, label: b.name })),
                  ]}
                  className="w-40"
                  aria-label="Filter by brand"
                />

                {view === "sales" && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={from}
                      max={to}
                      onChange={(e) => setFrom(e.target.value)}
                      className="w-40"
                      aria-label="From date"
                    />
                    <span className="text-xs text-[var(--color-neutral-500)]">to</span>
                    <Input
                      type="date"
                      value={to}
                      min={from}
                      onChange={(e) => setTo(e.target.value)}
                      className="w-40"
                      aria-label="To date"
                    />
                  </div>
                )}

                {hasFilters && (
                  <ClearFiltersButton
                    onClick={() => {
                      setCategorySlug("");
                      setBrandSlug("");
                    }}
                  />
                )}
              </div>

              <ExportButton onClick={exportRows} disabled={(active.data?.rows.length ?? 0) === 0} />
            </div>

            {view === "stock" && stockTotals && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                  label="Stock at cost"
                  value={money(stockTotals.costValue)}
                  hint={`${stockTotals.units} units across ${stockTotals.skuCount} SKUs`}
                />
                <StatTile label="At retail" value={money(stockTotals.retailValue)} />
                <StatTile label="Potential profit" value={money(stockTotals.potentialProfit)} />
                <StatTile
                  label="Margin"
                  value={
                    stockTotals.marginPercent === null
                      ? "—"
                      : `${stockTotals.marginPercent.toFixed(1)}%`
                  }
                />
              </div>
            )}

            {view === "sales" && salesTotals && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                  label="Revenue"
                  value={money(salesTotals.revenue)}
                  hint={`${salesTotals.unitsSold} units in ${salesTotals.orderCount} orders`}
                />
                <StatTile label="Estimated cost" value={money(salesTotals.estimatedCost)} />
                <StatTile label="Estimated profit" value={money(salesTotals.estimatedProfit)} />
                <StatTile
                  label="Margin"
                  value={
                    salesTotals.marginPercent === null
                      ? "—"
                      : `${salesTotals.marginPercent.toFixed(1)}%`
                  }
                />
              </div>
            )}

            {view === "stock" && (stockTotals?.unvaluedSkus ?? 0) > 0 && (
              <p className="inline-flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {stockTotals!.unvaluedSkus} SKU{stockTotals!.unvaluedSkus === 1 ? "" : "s"} have
                  never been bought, so they have no cost and are left out of the figures above.
                  Record a purchase for them and they will be valued.
                </span>
              </p>
            )}

            {view === "sales" && salesTotals && (
              <p className="inline-flex items-start gap-1.5 text-xs text-[var(--color-neutral-500)]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Revenue is after item discounts and before tax. Cancelled and returned orders are
                  excluded.{" "}
                  {salesTotals.unitsEstimated > 0 ? (
                    <>
                      {salesTotals.unitsEstimated} unit
                      {salesTotals.unitsEstimated === 1 ? " was" : "s were"} sold before the cost of
                      the day was recorded, so {salesTotals.unitsEstimated === 1 ? "it is" : "those are"}{" "}
                      costed at today&apos;s price and will move when buying prices move.
                    </>
                  ) : salesTotals.unitsSold > salesTotals.unitsWithoutCost ? (
                    <>Each line is costed at what the goods cost on the day they sold.</>
                  ) : (
                    <>Nothing sold here has a cost on record, so there is no margin to show.</>
                  )}
                </span>
              </p>
            )}
          </div>

          <div className="mt-5 flex-1 min-h-0 overflow-hidden flex flex-col">
            {active.isLoading && !active.data ? (
              <AdminTableSkeleton />
            ) : view === "stock" ? (
              <DataTable
                columns={stockColumns}
                data={stock.data?.rows ?? []}
                emptyMessage="Nothing to value yet"
                className="bg-white"
              />
            ) : (
              <DataTable
                columns={salesColumns}
                data={sales.data?.rows ?? []}
                emptyMessage="No sales in this period"
                className="bg-white"
              />
            )}
          </div>
        </div>
      </AdminContent>
    </div>
  );
}
