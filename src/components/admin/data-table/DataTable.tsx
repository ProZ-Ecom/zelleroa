"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown, Download } from "lucide-react";
import { usePathname } from "next/navigation";
import { exportTableToCsv } from "@/lib/export-csv";
import { cn } from "@/lib/utils";

import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  emptyMessage?: string;
  /** Show the CSV export button (default true). */
  exportable?: boolean;
  /** Base file name for the export; defaults to the current admin route segment. */
  exportFileName?: string;
}

function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  pageSize: controlledPageSize,
  pageSizeOptions = [10, 20, 30, 50],
  onPageSizeChange,
  page = 1,
  totalPages,
  totalItems,
  onPageChange,
  className,
  emptyMessage = "No results found.",
  exportable = true,
  exportFileName,
}: DataTableProps<TData, TValue>) {
  const [internalPageSize, setInternalPageSize] = React.useState<number>(
    controlledPageSize ?? 10
  );
  const [internalPage, setInternalPage] = React.useState<number>(page);

  const effectivePageSize = controlledPageSize ?? internalPageSize;
  const effectivePage = page ?? internalPage;

  React.useEffect(() => {
    if (controlledPageSize !== undefined) {
      setInternalPageSize(controlledPageSize);
    }
  }, [controlledPageSize]);

  React.useEffect(() => {
    if (page !== undefined) {
      setInternalPage(page);
    }
  }, [page]);

  const handlePageSizeChange = (newSize: number) => {
    setInternalPageSize(newSize);
    setInternalPage(1);
    onPageSizeChange?.(newSize);
    onPageChange?.(1);
  };

  const handlePageChange = (newPage: number) => {
    setInternalPage(newPage);
    onPageChange?.(newPage);
  };

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState("");

  const isServerSide = totalItems !== undefined && totalItems > data.length;
  const paginatedData = React.useMemo(() => {
    if (isServerSide || data.length <= effectivePageSize) {
      return data;
    }
    const startIndex = (effectivePage - 1) * effectivePageSize;
    return data.slice(startIndex, startIndex + effectivePageSize);
  }, [data, isServerSide, effectivePage, effectivePageSize]);

  const table = useReactTable({
    data: paginatedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
  });

  const pathname = usePathname();
  const handleExport = () =>
    exportTableToCsv(
      table,
      exportFileName ?? (pathname?.split("/").filter(Boolean).pop() || "export")
    );

  const computedTotalItems = totalItems !== undefined ? totalItems : data.length;
  const computedTotalPages =
    totalPages !== undefined && totalPages > 0
      ? totalPages
      : Math.max(1, Math.ceil(computedTotalItems / effectivePageSize));

  const startEntry =
    computedTotalItems > 0 ? (effectivePage - 1) * effectivePageSize + 1 : 0;

  const endEntry =
    computedTotalItems > 0
      ? Math.min(effectivePage * effectivePageSize, computedTotalItems)
      : 0;

    
  return (
    <div className={cn("w-full flex-1 flex flex-col justify-between rounded-2xl overflow-hidden min-h-[380px] border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-8px_rgba(16,24,40,0.08)]", className)}>
      {(searchKey || exportable) && (
        <div className="flex items-center justify-between gap-2 p-3 pb-0 flex-shrink-0">
          {searchKey ? (
            <SearchInput
              placeholder={searchPlaceholder}
              defaultValue={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
              onSearch={(value) => table.getColumn(searchKey)?.setFilterValue(value)}
              className="w-full max-w-sm"
            />
          ) : (
            <span />
          )}
          {exportable && (
            <button
              type="button"
              onClick={handleExport}
              disabled={!table.getRowModel().rows.length}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
              {Object.keys(rowSelection).length > 0 ? ` (${Object.keys(rowSelection).length})` : ""}
            </button>
          )}
        </div>
      )}

      <div className="min-h-[240px] flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain">
          <table className="w-full min-w-[720px] table-auto caption-bottom text-sm border-separate border-spacing-0">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="transition-colors">
                  {headerGroup.headers.map((header) => {
                    const isActions =
                      header.column.id.toLowerCase() === "actions" ||
                      header.id.toLowerCase() === "actions";
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          "group/th h-12 px-4 text-left align-middle text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-[var(--color-neutral-500)] uppercase sm:px-5 bg-neutral-50/95 backdrop-blur border-b border-neutral-200/80 sticky top-0 z-10",
                          isActions &&
                            "text-center sticky top-0 right-0 z-30 shadow-[-8px_0_12px_-6px_rgba(16,24,40,0.06)] bg-neutral-50",
                          header.column.getCanSort() &&
                            "cursor-pointer select-none hover:text-[var(--color-neutral-800)]"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            isActions ? "justify-center" : ""
                          )}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="text-neutral-300 transition-colors group-hover/th:text-neutral-500">
                              {header.column.getIsSorted() === "asc" ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : header.column.getIsSorted() === "desc" ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronsUpDown className="h-4 w-4" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="group transition-colors hover:bg-neutral-50/80 data-[state=selected]:bg-neutral-50"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isActions =
                        cell.column.id.toLowerCase() === "actions" ||
                        cell.id.toLowerCase().includes("actions");
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-4 py-3.5 align-middle whitespace-nowrap sm:px-5 bg-white group-hover:bg-neutral-50 transition-colors border-b border-neutral-100",
                            isActions &&
                              "text-center [&>div]:justify-center [&>div]:items-center sticky right-0 z-20 shadow-[-8px_0_12px_-6px_rgba(16,24,40,0.06)] bg-white group-hover:bg-neutral-50"
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center text-gray-500 bg-white border-b border-neutral-100">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-2.5 flex-shrink-0 border-t border-neutral-200/70 bg-neutral-50/40">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm text-[var(--color-neutral-500)]">
          <p>
            Showing {startEntry}–{endEntry} of {computedTotalItems} entries
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-neutral-600)] whitespace-nowrap">
              Rows per page:
            </span>
            <div className="w-20">
              <Select
                size="sm"
                value={String(effectivePageSize)}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                options={pageSizeOptions.map((opt) => ({
                  value: String(opt),
                  label: String(opt),
                }))}
                searchable={false}
                portal={true}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => handlePageChange(effectivePage - 1)}
            disabled={effectivePage <= 1}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200",
              "bg-white text-[var(--color-neutral-700)] shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-95",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold tabular-nums text-[var(--color-neutral-700)] border border-neutral-200/70">
            {effectivePage} / {computedTotalPages}
          </span>
          <button
            onClick={() => handlePageChange(effectivePage + 1)}
            disabled={effectivePage >= computedTotalPages}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200",
              "bg-white text-[var(--color-neutral-700)] shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-95",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            )}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { DataTable };
export type { DataTableProps };
