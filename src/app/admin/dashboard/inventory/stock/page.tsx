"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { History, Package, Settings2, SlidersHorizontal, X } from "lucide-react";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ScrollableTabs } from "@/components/ui/scrollable-tabs";
import { Button } from "@/components/ui/button";
import { ClearFiltersButton } from "@/components/common/clear-filters-button";
import { ExportButton } from "@/components/common/export-button";
import { exportDataToCsv } from "@/lib/export-csv";
import { StockStatusBadge } from "@/features/inventory/components/StockBadges";
import {
  useCurrentStock,
  useInventoryDashboard,
  useStockSettings,
} from "@/features/inventory/hooks/use-stock";
import { useCategories } from "@/features/categories/hooks";
import { useAdminProducts } from "@/features/products/hooks";
import { cn } from "@/lib/utils";
import type { StockRow, StockStatus } from "@/features/inventory/types/stock";

const STATUS_TABS: { id: StockStatus | ""; label: string }[] = [
  { id: "", label: "All items" },
  { id: "in_stock", label: "In stock" },
  { id: "low_stock", label: "Low stock" },
  { id: "out_of_stock", label: "Out of stock" },
];

/** "today" / "3 days ago" — easier to scan than a date when reviewing stock. */
function sinceLabel(iso: string | null) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "updated today";
  if (days === 1) return "updated yesterday";
  if (days < 30) return `updated ${days} days ago`;
  const months = Math.floor(days / 30);
  return `updated ${months} month${months === 1 ? "" : "s"} ago`;
}

function availableTone(status: StockStatus) {
  if (status === "out_of_stock") return "text-red-600";
  if (status === "low_stock") return "text-yellow-700";
  return "text-[var(--color-neutral-900)]";
}

/** The one place a row's numbers are formatted, so table and cards stay in sync. */
function AvailableCell({ row }: { row: StockRow }) {
  return (
    <div>
      <span className={cn("text-base font-semibold tabular-nums", availableTone(row.status))}>
        {row.available}
      </span>
      {row.reserved > 0 && (
        <span className="ml-1.5 text-xs text-neutral-500">+{row.reserved} in carts</span>
      )}
    </div>
  );
}

function RowActions({ row, full = false }: { row: StockRow; full?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5", full ? "justify-end" : "justify-center")}>
      <Link href={`/admin/dashboard/inventory/adjustment?item=${row.variantUnitPriceId}`}>
        <Button variant="outline" size="sm" className="rounded-lg">
          <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Adjust
        </Button>
      </Link>
      <Link href={`/admin/dashboard/inventory/movements?item=${row.variantUnitPriceId}`}>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg px-2"
          title="Stock history"
          aria-label={`Stock history for ${row.productName}`}
        >
          <History className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

/** Removable chip for a filter that is currently narrowing the list. */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="cursor-pointer rounded-full p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function CurrentStockContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialStatus = searchParams.get("status");
  const [search, setSearch] = useState("");
  const [color, setColor] = useState("");
  const [status, setStatus] = useState<StockStatus | "">(
    STATUS_TABS.some((s) => s.id && s.id === initialStatus)
      ? ((initialStatus as StockStatus) ?? "")
      : ""
  );
  const [categorySlug, setCategorySlug] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, isFetching, error, refetch } = useCurrentStock({
    page,
    limit: pageSize,
    search: search || undefined,
    color: color || undefined,
    categorySlug: categorySlug || undefined,
    productSlug: productSlug || undefined,
    status: status || undefined,
  });
  const { data: settings } = useStockSettings();
  const { data: summary } = useInventoryDashboard();

  const { data: categoryData } = useCategories({ page: 1, pageSize: 200 });
  const categories = categoryData?.data ?? [];
  // The products endpoint takes the category's public UUID, the filters its slug.
  const categoryUuid = categories.find((c) => c.slug === categorySlug)?.id;
  // 100 is the list endpoint's ceiling; a category narrows it well before that.
  const { data: productData } = useAdminProducts({
    limit: 100,
    isActive: true,
    ...(categoryUuid ? { categoryId: String(categoryUuid) } : {}),
  });
  const products = productData?.data ?? [];

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? rows.length;
  const totalPages = data?.meta?.totalPages ?? 1;
  const currentPage = data?.meta?.page ?? page;
  const hasFilters = !!search || !!color || !!status || !!categorySlug || !!productSlug;
  const threshold = settings?.lowStockThreshold ?? summary?.lowStockThreshold ?? 5;

  /** Keep the status in the URL so a refresh, a back button or a shared link keeps the view. */
  const selectStatus = useCallback(
    (next: StockStatus | "") => {
      setStatus(next);
      setPage(1);
      router.replace(next ? `${pathname}?status=${next}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const counts: Record<string, number | undefined> = summary
    ? {
        "": summary.totalVariants,
        in_stock: Math.max(0, summary.totalVariants - summary.lowStockItems - summary.outOfStockItems),
        low_stock: summary.lowStockItems,
        out_of_stock: summary.outOfStockItems,
      }
    : {};

  /** Picking a category narrows the product list, so a product from another one is dropped. */
  const selectCategory = (slug: string) => {
    setCategorySlug(slug);
    setProductSlug("");
    setPage(1);
  };

  const clearAll = () => {
    setSearch("");
    setColor("");
    setCategorySlug("");
    setProductSlug("");
    selectStatus("");
  };

  const columns: ColumnDef<StockRow>[] = [
    {
      id: "product",
      header: "Product",
      accessorFn: (row) => row.productName,
      cell: ({ row }) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-[var(--color-neutral-900)]">{row.original.productName}</p>
          <p className="text-xs text-[var(--color-neutral-500)]">{row.original.sku}</p>
        </div>
      ),
    },
    {
      id: "variant",
      header: "Colour / Size",
      accessorFn: (row) => `${row.colorName ?? ""} ${row.sizeName ?? ""}`.trim(),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {[row.original.colorName, row.original.sizeName].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      id: "available",
      header: "Available",
      accessorFn: (row) => row.available,
      cell: ({ row }) => (
        <div>
          <AvailableCell row={row.original} />
          <p className="text-xs text-neutral-500">
            reorder at {row.original.threshold}
            {row.original.reorderLevel > 0 && " (own)"}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => row.status,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <StockStatusBadge status={row.original.status} />
          {sinceLabel(row.original.updatedAt) && (
            <p className="mt-1 text-xs text-neutral-500">{sinceLabel(row.original.updatedAt)}</p>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => <RowActions row={row.original} />,
    },
  ];

  const exportRows = () =>
    exportDataToCsv(
      rows.map((r) => ({
        Product: r.productName,
        SKU: r.sku,
        Color: r.colorName || "—",
        Size: r.sizeName || "—",
        Available: r.available,
        Reserved: r.reserved,
        "Reorder at": r.threshold,
        Status: r.status,
      })),
      "current-stock"
    );

  if (error) return <ErrorState message="Failed to load stock" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Current Stock"
        description={`What is on hand for every colour and size. Anything at ${threshold} units or fewer is flagged as low stock.`}
        actions={
          <>
            <Link href="/admin/dashboard/inventory">
              <Button variant="outline" className="h-11 rounded-xl">
                <Settings2 className="mr-2 h-4 w-4" /> Inventory overview
              </Button>
            </Link>
            <Link href="/admin/dashboard/inventory/adjustment">
              <Button className="h-11 rounded-xl bg-theme-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-theme-primary-hover">
                Adjust stock
              </Button>
            </Link>
          </>
        }
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden py-1">
          <div className="flex-shrink-0 space-y-4">
            {/* One click per stock state, with how many items are in each. */}
            <ScrollableTabs>
              {STATUS_TABS.map((tab) => {
                const isActive = status === tab.id;
                const count = counts[tab.id];
                return (
                  <button
                    key={tab.id || "all"}
                    type="button"
                    onClick={() => selectStatus(tab.id)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                      isActive
                        ? "border-secondary-600 bg-secondary-600 text-cream-white shadow-xs"
                        : "border-cream-border-subtle bg-white text-neutral-500 hover:border-cream-border-hover hover:bg-cream-200 hover:text-secondary-800"
                    )}
                  >
                    <span>{tab.label}</span>
                    {count !== undefined && (
                      <span
                        className={cn(
                          "grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                          isActive ? "bg-white/20 text-white" : "bg-cream-300 text-secondary-600"
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </ScrollableTabs>

            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SearchInput
                  placeholder="Search product name or SKU..."
                  value={search}
                  onSearch={(v) => {
                    setSearch(v);
                    setPage(1);
                  }}
                  className="w-full"
                />
                <Select
                  value={categorySlug}
                  onValueChange={selectCategory}
                  options={[
                    { value: "", label: "All categories" },
                    ...categories.map((c) => ({ value: c.slug, label: c.name })),
                  ]}
                  placeholder="All categories"
                  className="w-full"
                  aria-label="Filter by category"
                />
                <Select
                  value={productSlug}
                  onValueChange={(v) => {
                    setProductSlug(v);
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "All products" },
                    ...products.map((p) => ({ value: p.slug, label: p.name })),
                  ]}
                  placeholder="All products"
                  className="w-full"
                  aria-label="Filter by product"
                />
                <SearchInput
                  placeholder="Filter by colour..."
                  value={color}
                  onSearch={(v) => {
                    setColor(v);
                    setPage(1);
                  }}
                  className="w-full"
                />
              </div>

              <ExportButton onClick={exportRows} disabled={rows.length === 0} />
            </div>

            {hasFilters && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-500">
                  {isLoading && !data ? "Loading…" : `${total} item${total === 1 ? "" : "s"}`}
                  {isFetching && data ? " · updating…" : ""}
                </span>
                {search && <FilterChip label={`Search: ${search}`} onRemove={() => setSearch("")} />}
                {categorySlug && (
                  <FilterChip
                    label={`Category: ${
                      categories.find((c) => c.slug === categorySlug)?.name ?? categorySlug
                    }`}
                    onRemove={() => selectCategory("")}
                  />
                )}
                {productSlug && (
                  <FilterChip
                    label={`Product: ${
                      products.find((p) => p.slug === productSlug)?.name ?? productSlug
                    }`}
                    onRemove={() => setProductSlug("")}
                  />
                )}
                {color && <FilterChip label={`Colour: ${color}`} onRemove={() => setColor("")} />}
                {status && (
                  <FilterChip
                    label={STATUS_TABS.find((t) => t.id === status)?.label ?? status}
                    onRemove={() => selectStatus("")}
                  />
                )}
                <ClearFiltersButton onClick={clearAll} />
              </div>
            )}
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden">
            {isLoading && !data ? (
              <AdminTableSkeleton />
            ) : (
              <>
                {/* Phones get cards; the table needs 720px to stay readable. */}
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto md:hidden">
                  {rows.length === 0 ? (
                    <EmptyState
                      title={hasFilters ? "No stock matches these filters" : "No stock items yet"}
                      description={
                        hasFilters
                          ? "Try a different search, colour or stock state."
                          : "Stock appears here once products have colours and sizes with inventory."
                      }
                      icon={<Package className="h-8 w-8 text-muted-foreground" />}
                    >
                      {hasFilters && <ClearFiltersButton onClick={clearAll} />}
                    </EmptyState>
                  ) : (
                    rows.map((row) => (
                      <div
                        key={row.variantUnitPriceId}
                        className="rounded-2xl border border-neutral-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-[var(--color-neutral-900)]">
                              {row.productName}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {[row.colorName, row.sizeName].filter(Boolean).join(" · ") || "Default"}{" "}
                              · {row.sku}
                            </p>
                          </div>
                          <span className="shrink-0 whitespace-nowrap">
                            <StockStatusBadge status={row.status} />
                          </span>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div>
                            <AvailableCell row={row} />
                            <p className="text-xs text-neutral-500">
                              {["reorder at " + row.threshold, sinceLabel(row.updatedAt)]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <RowActions row={row} full />
                        </div>
                      </div>
                    ))
                  )}
                  {totalPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setPage}
                      className="py-2"
                    />
                  )}
                </div>

                <div className="hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
                  <DataTable
                    columns={columns}
                    data={rows}
                    emptyMessage={
                      hasFilters ? "No stock matches these filters" : "No stock items yet"
                    }
                    pageSize={pageSize}
                    pageSizeOptions={[10, 20, 50, 100]}
                    page={currentPage}
                    totalPages={totalPages}
                    totalItems={total}
                    onPageChange={setPage}
                    onPageSizeChange={(n) => {
                      setPageSize(n);
                      setPage(1);
                    }}
                    className="bg-white"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </AdminContent>
    </div>
  );
}

export default function CurrentStockPage() {
  return (
    <Suspense fallback={<AdminTableSkeleton />}>
      <CurrentStockContent />
    </Suspense>
  );
}
