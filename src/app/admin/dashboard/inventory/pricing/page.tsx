"use client";

import type { Dispatch, SetStateAction } from "react";
import { Suspense, createContext, useContext, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Info, Percent, Save, X } from "lucide-react";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClearFiltersButton } from "@/components/common/clear-filters-button";
import { ExportButton } from "@/components/common/export-button";
import { exportDataToCsv } from "@/lib/export-csv";
import { VariantLabel } from "@/features/inventory/components/StockBadges";
import { usePricing, useApplyPricing } from "@/features/inventory/hooks/use-pricing";
import type { PricingMode, PricingRow } from "@/features/inventory/types/pricing";
import { useBrands } from "@/features/brands/hooks";
import { useCategories } from "@/features/categories/hooks";

const money = (n: number) => `₹${n.toFixed(2)}`;
const dash = <span className="text-[var(--color-neutral-400)]">—</span>;

type BulkMode = Exclude<PricingMode, "manual">;

const BULK_MODES: { value: BulkMode; label: string; hint: string; suffix: string }[] = [
  { value: "percent", label: "Change by %", hint: "10 raises by 10%, -5 cuts by 5%", suffix: "%" },
  { value: "amount", label: "Change by ₹", hint: "50 adds ₹50, -20 takes ₹20 off", suffix: "₹" },
  { value: "set", label: "Set price to", hint: "The same price on every selected item", suffix: "₹" },
  { value: "markup", label: "Cost + markup %", hint: "Priced off each item's own last cost", suffix: "%" },
];

/** Mirrors the server so the admin sees the result before committing to it. */
function preview(row: PricingRow, mode: BulkMode, value: number, roundRupee: boolean): number | null {
  let next: number;
  if (mode === "set") next = value;
  else if (mode === "percent") next = row.sellingPrice * (1 + value / 100);
  else if (mode === "amount") next = row.sellingPrice + value;
  else {
    if (row.costPrice === null) return null;
    next = row.costPrice * (1 + value / 100);
  }
  if (roundRupee) next = Math.round(next);
  return Math.round(next * 100) / 100;
}

/**
 * The table renders each cell straight from the column definitions, so a column
 * array rebuilt on every keystroke hands React a new component type and
 * remounts the price inputs — the cursor would drop out after each digit. The
 * definitions below are therefore module-level and never change identity; the
 * cells that need live state read it from this context instead.
 */
interface PricingTableState {
  rows: PricingRow[];
  drafts: Record<string, string>;
  selected: Set<string>;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
}

const PricingTableContext = createContext<PricingTableState | null>(null);

function usePricingTable() {
  const ctx = useContext(PricingTableContext);
  if (!ctx) throw new Error("Pricing table cells must render inside PricingTableContext");
  return ctx;
}

function SelectAllHeader() {
  const { rows, selected, setSelected } = usePricingTable();
  return (
    <Checkbox
      checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
      aria-label="Select all on this page"
      onChange={(e) =>
        setSelected((prev) => {
          const next = new Set(prev);
          for (const r of rows) {
            if (e.target.checked) next.add(r.id);
            else next.delete(r.id);
          }
          return next;
        })
      }
    />
  );
}

function SelectCell({ row }: { row: PricingRow }) {
  const { selected, setSelected } = usePricingTable();
  return (
    <Checkbox
      checked={selected.has(row.id)}
      aria-label={`Select ${row.sku}`}
      onChange={() =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(row.id)) next.delete(row.id);
          else next.add(row.id);
          return next;
        })
      }
    />
  );
}

function PriceCell({ row }: { row: PricingRow }) {
  const { drafts, setDrafts } = usePricingTable();
  const draft = drafts[row.id];
  const changed = draft !== undefined && draft !== "" && Number(draft) !== row.sellingPrice;
  return (
    <Input
      type="number"
      min={0}
      // Prices are nudged in rupees, so the arrow keys move by ₹1; paise can
      // still be typed in.
      step={1}
      className={`w-28 ${changed ? "border-amber-400 bg-amber-50" : ""}`}
      value={draft ?? String(row.sellingPrice)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDrafts((p) => ({ ...p, [row.id]: e.target.value }))}
    />
  );
}

const COLUMNS: ColumnDef<PricingRow>[] = [
  {
    id: "select",
    header: () => <SelectAllHeader />,
    cell: ({ row }) => <SelectCell row={row.original} />,
  },
  {
    id: "product",
    header: "Product",
    accessorFn: (row) => row.productName,
    cell: ({ row }) => <VariantLabel item={row.original} />,
  },
  {
    id: "stock",
    header: "Stock",
    accessorFn: (row) => row.stock,
    cell: ({ row }) => <span className="tabular-nums">{row.original.stock}</span>,
  },
  {
    id: "cost",
    header: "Last cost",
    accessorFn: (row) => row.costPrice ?? -1,
    cell: ({ row }) => {
      const r = row.original;
      if (r.costPrice !== null) return <span className="tabular-nums">{money(r.costPrice)}</span>;
      // Nothing to price against until the SKU has been bought in, so say so
      // rather than leaving a dash the admin has to interpret.
      if (r.avgCost === null) {
        return (
          <span
            className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
            title="This SKU has never been received on a purchase order, so there is no cost to price against."
          >
            Not purchased
          </span>
        );
      }
      return dash;
    },
  },
  {
    id: "avgCost",
    header: "Avg cost",
    accessorFn: (row) => row.avgCost ?? -1,
    cell: ({ row }) =>
      row.original.avgCost === null ? (
        dash
      ) : (
        <span className="tabular-nums text-[var(--color-neutral-500)]">
          {money(row.original.avgCost)}
        </span>
      ),
  },
  {
    id: "price",
    header: "Selling price",
    accessorFn: (row) => row.sellingPrice,
    cell: ({ row }) => <PriceCell row={row.original} />,
  },
  {
    id: "margin",
    header: "Margin",
    accessorFn: (row) => row.marginPercent ?? -999,
    cell: ({ row }) => {
      const m = row.original.marginPercent;
      if (m === null) return dash;
      const tone = m < 0 ? "text-red-600" : m < 10 ? "text-amber-600" : "text-emerald-600";
      return <span className={`tabular-nums font-medium ${tone}`}>{m.toFixed(1)}%</span>;
    },
  },
  {
    id: "stockValue",
    header: "Stock value",
    accessorFn: (row) => row.stockValue ?? -1,
    cell: ({ row }) =>
      row.original.stockValue === null ? (
        dash
      ) : (
        <span className="tabular-nums text-[var(--color-neutral-500)]">
          {money(row.original.stockValue)}
        </span>
      ),
  },
];

function PricingContent() {
  // The catalog links here per product, e.g. "Edit prices" on a product page.
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [categorySlug, setCategorySlug] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [belowCost, setBelowCost] = useState(false);
  const [unpriced, setUnpriced] = useState(false);
  const [noCost, setNoCost] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<BulkMode>("percent");
  const [bulkValue, setBulkValue] = useState("");
  const [roundRupee, setRoundRupee] = useState(true);

  const { data, isLoading, error, refetch } = usePricing({
    page,
    pageSize,
    search: search || undefined,
    categorySlug: categorySlug || undefined,
    brandSlug: brandSlug || undefined,
    belowCost,
    unpriced,
    noCost,
  });
  const rows = useMemo(() => data?.data ?? [], [data]);
  const apply = useApplyPricing();

  const { data: categoryData } = useCategories({ page: 1, pageSize: 200 });
  const { data: brandData } = useBrands({ page: 1, limit: 100 });

  const hasFilters = !!search || !!categorySlug || !!brandSlug || belowCost || unpriced || noCost;
  const resetPage = () => setPage(1);

  // Only rows still on screen can be acted on, so a filter change drops the rest.
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const dirty = rows.filter(
    (r) => drafts[r.id] !== undefined && drafts[r.id] !== "" && Number(drafts[r.id]) !== r.sellingPrice
  );

  const saveDrafts = async () => {
    const invalid = dirty.find((r) => {
      const n = Number(drafts[r.id]);
      return !Number.isFinite(n) || n < 0;
    });
    if (invalid) return;
    await apply.mutateAsync({
      mode: "manual",
      prices: dirty.map((r) => ({ id: r.id, sellingPrice: Number(drafts[r.id]) })),
    });
    setDrafts({});
  };

  const runBulk = async () => {
    const value = Number(bulkValue);
    if (!Number.isFinite(value)) return;
    await apply.mutateAsync({
      mode,
      ids: selectedRows.map((r) => r.id),
      value,
      rounding: roundRupee ? "rupee" : "none",
    });
    setSelected(new Set());
    setBulkValue("");
  };

  const tableState = useMemo<PricingTableState>(
    () => ({ rows, drafts, selected, setDrafts, setSelected }),
    [rows, drafts, selected]
  );

  if (error) return <ErrorState message="Failed to load pricing" onRetry={() => refetch()} />;

  const modeConfig = BULK_MODES.find((m) => m.value === mode)!;
  const bulkNumber = Number(bulkValue);
  const canBulk = selectedRows.length > 0 && bulkValue !== "" && Number.isFinite(bulkNumber);
  const samples = canBulk ? selectedRows.slice(0, 3) : [];

  return (
    <PricingTableContext.Provider value={tableState}>
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Pricing"
        description="Cost, selling price and margin per SKU. This is where prices are set — the catalog only describes what a product is."
      />

      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden py-1">
          <div className="flex-shrink-0 flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <SearchInput
                  placeholder="Search product, item or SKU..."
                  defaultValue={search}
                  onSearch={(v) => {
                    setSearch(v);
                    resetPage();
                  }}
                  className="w-full max-w-sm"
                />
                <Select
                  value={categorySlug}
                  onValueChange={(v) => {
                    setCategorySlug(v);
                    resetPage();
                  }}
                  options={[
                    { value: "", label: "All categories" },
                    ...(categoryData?.data ?? []).map((c) => ({ value: c.slug, label: c.name })),
                  ]}
                  className="w-full sm:w-48"
                  aria-label="Filter by category"
                />
                <Select
                  value={brandSlug}
                  onValueChange={(v) => {
                    setBrandSlug(v);
                    resetPage();
                  }}
                  options={[
                    { value: "", label: "All brands" },
                    ...(brandData?.data ?? []).map((b) => ({ value: b.slug, label: b.name })),
                  ]}
                  className="w-full sm:w-44"
                  aria-label="Filter by brand"
                />
                <Checkbox
                  label="At or below cost"
                  checked={belowCost}
                  onChange={(e) => {
                    setBelowCost(e.target.checked);
                    resetPage();
                  }}
                />
                <Checkbox
                  label="No price set"
                  checked={unpriced}
                  onChange={(e) => {
                    setUnpriced(e.target.checked);
                    resetPage();
                  }}
                />
                <Checkbox
                  label="No purchase cost"
                  checked={noCost}
                  onChange={(e) => {
                    setNoCost(e.target.checked);
                    resetPage();
                  }}
                />
                {hasFilters && (
                  <ClearFiltersButton
                    onClick={() => {
                      setSearch("");
                      setCategorySlug("");
                      setBrandSlug("");
                      setBelowCost(false);
                      setUnpriced(false);
                      setNoCost(false);
                      resetPage();
                    }}
                  />
                )}
              </div>

              <ExportButton
                onClick={() =>
                  exportDataToCsv(
                    rows.map((r) => ({
                      Product: r.productName,
                      SKU: r.sku,
                      Colour: r.colorName || "—",
                      Size: r.sizeName || "—",
                      Stock: r.stock,
                      "Last cost": r.costPrice ?? "",
                      "Avg cost": r.avgCost ?? "",
                      "Selling price": r.sellingPrice,
                      "Margin %": r.marginPercent ?? "",
                      "Stock value": r.stockValue ?? "",
                    })),
                    "pricing"
                  )
                }
                disabled={rows.length === 0}
              />
            </div>

            {dirty.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-medium text-amber-900">
                  {dirty.length} price{dirty.length === 1 ? "" : "s"} edited but not saved
                </p>
                <Button size="sm" onClick={saveDrafts} isLoading={apply.isPending}>
                  <Save className="mr-1.5 h-4 w-4" /> Save changes
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDrafts({})}>
                  <X className="mr-1.5 h-4 w-4" /> Discard
                </Button>
              </div>
            )}

            {selectedRows.length > 0 && (
              <div className="space-y-2 rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <Percent className="h-4 w-4" /> {selectedRows.length} selected
                  </span>
                  <Select
                    value={mode}
                    onValueChange={(v) => setMode(v as BulkMode)}
                    options={BULK_MODES.map((m) => ({ value: m.value, label: m.label }))}
                    className="w-48"
                    aria-label="Bulk pricing action"
                  />
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      className="w-32"
                      placeholder="0"
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                    />
                    <span className="text-sm text-[var(--color-neutral-500)]">{modeConfig.suffix}</span>
                  </div>
                  <Checkbox
                    label="Round to whole rupees"
                    checked={roundRupee}
                    onChange={(e) => setRoundRupee(e.target.checked)}
                  />
                  <Button size="sm" onClick={runBulk} disabled={!canBulk} isLoading={apply.isPending}>
                    Apply to {selectedRows.length}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </div>
                <p className="inline-flex items-start gap-1.5 text-xs text-[var(--color-neutral-500)]">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {modeConfig.hint}
                    {samples.length > 0 && ". "}
                    {samples.map((r, i) => {
                      const next = preview(r, mode, bulkNumber, roundRupee);
                      return (
                        <span key={r.id}>
                          {i > 0 && ", "}
                          {r.sku}: {money(r.sellingPrice)} →{" "}
                          {next === null ? "skipped (no cost)" : money(next)}
                        </span>
                      );
                    })}
                    {selectedRows.length > samples.length && samples.length > 0
                      ? `, and ${selectedRows.length - samples.length} more`
                      : ""}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 flex-1 min-h-0 overflow-hidden flex flex-col">
            {isLoading && !data ? (
              <AdminTableSkeleton />
            ) : (
              <DataTable
                columns={COLUMNS}
                data={rows}
                emptyMessage={hasFilters ? "No items match these filters" : "No items yet"}
                pageSize={pageSize}
                pageSizeOptions={[25, 50, 100]}
                page={data?.meta?.page ?? page}
                totalPages={data?.meta?.totalPages ?? 1}
                totalItems={data?.meta?.total ?? rows.length}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setPageSize(n);
                  resetPage();
                }}
                className="bg-white"
              />
            )}
          </div>
        </div>
      </AdminContent>
    </div>
    </PricingTableContext.Provider>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<AdminTableSkeleton />}>
      <PricingContent />
    </Suspense>
  );
}
