"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { SlidersHorizontal, History } from "lucide-react";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { ClearFiltersButton } from "@/components/common/clear-filters-button";
import { StockStatusBadge, VariantLabel } from "@/features/inventory/components/StockBadges";
import { useCurrentStock, useStockSettings } from "@/features/inventory/hooks/use-stock";
import type { StockRow, StockStatus } from "@/features/inventory/types/stock";

const STATUSES: { value: StockStatus | ""; label: string }[] = [
  { value: "", label: "All stock" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

function CurrentStockContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [search, setSearch] = useState("");
  const [color, setColor] = useState("");
  const [status, setStatus] = useState<StockStatus | "">(
    STATUSES.some((s) => s.value === initialStatus) ? ((initialStatus as StockStatus) ?? "") : ""
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, error, refetch } = useCurrentStock({
    page,
    limit: pageSize,
    search: search || undefined,
    color: color || undefined,
    status: status || undefined,
  });
  const { data: settings } = useStockSettings();
  const rows = data?.data ?? [];
  const hasFilters = !!search || !!color || !!status;

  const columns: ColumnDef<StockRow>[] = [
    {
      id: "product",
      header: "Product",
      cell: ({ row }) => <VariantLabel item={row.original} />,
    },
    { id: "color", header: "Colour", cell: ({ row }) => row.original.colorName ?? "—" },
    { id: "size", header: "Size", cell: ({ row }) => row.original.sizeName ?? "—" },
    {
      id: "available",
      header: "Available",
      cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.available}</span>,
    },
    {
      id: "reserved",
      header: "In carts",
      cell: ({ row }) => <span className="tabular-nums text-neutral-500">{row.original.reserved}</span>,
    },
    {
      id: "threshold",
      header: "Low at",
      cell: ({ row }) => <span className="tabular-nums text-neutral-500">≤ {row.original.threshold}</span>,
    },
    { id: "status", header: "Status", cell: ({ row }) => <StockStatusBadge status={row.original.status} /> },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1.5">
          <Link href={`/admin/dashboard/inventory/adjustment?item=${row.original.variantUnitPriceId}`}>
            <Button variant="ghost" size="sm" title="Adjust stock">
              <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Adjust
            </Button>
          </Link>
          <Link href={`/admin/dashboard/inventory/movements?item=${row.original.variantUnitPriceId}`}>
            <Button variant="ghost" size="sm" title="Stock history">
              <History className="mr-1.5 h-4 w-4" /> History
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  if (error) return <ErrorState message="Failed to load stock" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Current Stock"
        description={`Stock per colour and size. Low stock is flagged at ${settings?.lowStockThreshold ?? 5} units or fewer.`}
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden py-1">
          <div className="flex-shrink-0 flex flex-col gap-3 md:flex-row md:items-center">
            <SearchInput
              placeholder="Search product, item or SKU..."
              defaultValue={search}
              onSearch={(v) => {
                setSearch(v);
                setPage(1);
              }}
              className="w-full max-w-md"
            />
            <SearchInput
              placeholder="Colour..."
              defaultValue={color}
              onSearch={(v) => {
                setColor(v);
                setPage(1);
              }}
              className="w-full md:w-48"
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StockStatus | "");
                setPage(1);
              }}
              className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm focus:border-secondary-600 focus:outline-none"
              aria-label="Filter by stock status"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {hasFilters && (
              <ClearFiltersButton
                onClick={() => {
                  setSearch("");
                  setColor("");
                  setStatus("");
                  setPage(1);
                }}
              />
            )}
          </div>

          <div className="mt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            {isLoading && !data ? (
              <AdminTableSkeleton />
            ) : (
              <DataTable
                columns={columns}
                data={rows}
                emptyMessage={hasFilters ? "No stock matches these filters" : "No stock items yet"}
                pageSize={pageSize}
                pageSizeOptions={[10, 20, 50, 100]}
                page={data?.meta?.page ?? page}
                totalPages={data?.meta?.totalPages ?? 1}
                totalItems={data?.meta?.total ?? rows.length}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
                className="bg-white"
              />
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
