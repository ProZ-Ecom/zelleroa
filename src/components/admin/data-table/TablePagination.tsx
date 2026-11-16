"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

export interface TablePaginationProps {
  page: number;
  totalPages?: number;
  total: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

/**
 * Standard table pagination matching the DataTable footer:
 * - Left: "Showing 1–10 of 100 entries" and "Rows per page: [ 10 v ]"
 * - Right: [<] [1 / 10] [>]
 */
export function TablePagination({
  page,
  totalPages,
  total,
  pageSize: controlledPageSize,
  pageSizeOptions = [10, 20, 30, 50],
  onPageChange,
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  const [internalPageSize, setInternalPageSize] = useState(controlledPageSize ?? 10);
  const effectivePageSize = controlledPageSize ?? internalPageSize;

  const handlePageSizeChange = (newSize: number) => {
    setInternalPageSize(newSize);
    onPageChange?.(1);
    onPageSizeChange?.(newSize);
  };

  const computedTotalItems = total ?? 0;
  const computedTotalPages =
    totalPages !== undefined && totalPages > 0
      ? totalPages
      : Math.max(1, Math.ceil(computedTotalItems / effectivePageSize));

  const startEntry =
    computedTotalItems > 0 ? (page - 1) * effectivePageSize + 1 : 0;
  const endEntry =
    computedTotalItems > 0
      ? Math.min(page * effectivePageSize, computedTotalItems)
      : 0;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-2.5 flex-shrink-0 border-t border-neutral-200/70 bg-neutral-50/95 backdrop-blur sticky bottom-0 z-20",
        className
      )}
    >
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
              onValueChange={(val) => handlePageSizeChange(Number(val))}
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
          type="button"
          onClick={() => onPageChange?.(page - 1)}
          disabled={page <= 1}
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
          {page} / {computedTotalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= computedTotalPages}
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
  );
}

