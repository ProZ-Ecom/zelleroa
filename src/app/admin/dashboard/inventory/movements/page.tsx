"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { Input } from "@/components/ui/input";
import { ClearFiltersButton } from "@/components/common/clear-filters-button";
import { MovementTypeBadge, SignedQuantity, VariantLabel } from "@/features/inventory/components/StockBadges";
import { useStockMovements } from "@/features/inventory/hooks/use-stock";
import { formatDateTime } from "@/lib/utils";
import type { MovementRow, MovementType } from "@/features/inventory/types/stock";

const TYPES: { value: MovementType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "SALE", label: "Sale" },
  { value: "RETURN", label: "Return" },
  { value: "REPLACEMENT", label: "Replacement" },
  { value: "ADJUSTMENT", label: "Adjustment" },
];

const columns: ColumnDef<MovementRow>[] = [
  {
    id: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm">{formatDateTime(row.original.createdAt)}</span>
    ),
  },
  { id: "product", header: "Product", cell: ({ row }) => <VariantLabel item={row.original} /> },
  { id: "color", header: "Colour", cell: ({ row }) => row.original.colorName ?? "—" },
  { id: "size", header: "Size", cell: ({ row }) => row.original.sizeName ?? "—" },
  { id: "type", header: "Type", cell: ({ row }) => <MovementTypeBadge type={row.original.movementType} /> },
  { id: "qty", header: "Qty", cell: ({ row }) => <SignedQuantity value={row.original.signedQuantity} /> },
  {
    id: "stock",
    header: "Stock",
    cell: ({ row }) =>
      row.original.previousStock === null ? (
        <span className="text-neutral-400">—</span>
      ) : (
        <span className="whitespace-nowrap tabular-nums text-sm">
          {row.original.previousStock} → <strong>{row.original.newStock}</strong>
        </span>
      ),
  },
  {
    id: "reference",
    header: "Reference",
    cell: ({ row }) => <span className="text-sm">{row.original.referenceNumber ?? "—"}</span>,
  },
  {
    id: "reason",
    header: "Reason",
    cell: ({ row }) => (
      <span className="block max-w-[260px] truncate text-sm" title={row.original.reason ?? undefined}>
        {row.original.reason ?? "—"}
      </span>
    ),
  },
  { id: "by", header: "By", cell: ({ row }) => <span className="text-sm">{row.original.createdBy ?? "System"}</span> },
];

function MovementsContent() {
  const searchParams = useSearchParams();
  const itemParam = Number(searchParams.get("item"));
  const [variantUnitPriceId, setItem] = useState<number | undefined>(
    Number.isInteger(itemParam) && itemParam > 0 ? itemParam : undefined
  );
  const [search, setSearch] = useState("");
  const [type, setType] = useState<MovementType | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, error, refetch } = useStockMovements({
    page,
    limit: pageSize,
    search: search || undefined,
    type: type || undefined,
    variantUnitPriceId,
    from: from || undefined,
    to: to || undefined,
  });
  const rows = data?.data ?? [];
  const hasFilters = !!search || !!type || !!from || !!to || !!variantUnitPriceId;

  if (error) return <ErrorState message="Failed to load stock movements" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Stock Movements"
        description={
          variantUnitPriceId
            ? "History for one product colour/size. Clear the filter to see everything."
            : "Every change to your stock, with the level before and after."
        }
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden py-1">
          <div className="flex-shrink-0 flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              placeholder="Search product, SKU, order / PO number..."
              defaultValue={search}
              onSearch={(v) => {
                setSearch(v);
                setPage(1);
              }}
              className="w-full max-w-md"
            />
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as MovementType | "");
                setPage(1);
              }}
              className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm focus:border-secondary-600 focus:outline-none"
              aria-label="Filter by movement type"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                aria-label="From date"
              />
              <span className="text-sm text-neutral-500">to</span>
              <Input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                aria-label="To date"
              />
            </div>
            {hasFilters && (
              <ClearFiltersButton
                onClick={() => {
                  setSearch("");
                  setType("");
                  setFrom("");
                  setTo("");
                  setItem(undefined);
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
                emptyMessage={hasFilters ? "No movements match these filters" : "No stock movements yet"}
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

export default function StockMovementsPage() {
  return (
    <Suspense fallback={<AdminTableSkeleton />}>
      <MovementsContent />
    </Suspense>
  );
}
