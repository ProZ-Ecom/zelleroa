"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  pageSizeOptions = [10, 20, 50, 100],
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

/** Button pager for client (react-query) pages matching standard DataTable pagination. */
export function ButtonPager({
  page,
  totalPages,
  total,
  onPage,
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
}: {
  page: number;
  totalPages?: number;
  total: number;
  onPage: (p: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  return (
    <TablePagination
      page={page}
      totalPages={totalPages}
      total={total}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      onPageChange={onPage}
      onPageSizeChange={onPageSizeChange}
    />
  );
}

/** Link pager for server-rendered pages matching standard DataTable pagination. */
export function LinkPager({
  basePath,
  params,
  page,
  totalPages,
  total,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  pageSizeOptions?: number[];
}) {
  const router = useRouter();
  const currentLimit = Number(params.limit ?? params.pageSize ?? pageSize);
  const effectivePageSize = Number.isFinite(currentLimit) && currentLimit > 0 ? currentLimit : 10;

  const href = (p: number, limitVal = effectivePageSize) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page" && k !== "limit" && k !== "pageSize") {
        search.set(k, v);
      }
    }
    search.set("page", String(p));
    if (limitVal !== 10) search.set("limit", String(limitVal));
    return `${basePath}?${search.toString()}`;
  };

  const handlePageSizeChange = (newSize: number) => {
    router.push(href(1, newSize));
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-2.5 flex-shrink-0 border-t border-neutral-200/70 bg-neutral-50/95 backdrop-blur sticky bottom-0 z-20">
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
        <Link
          href={href(Math.max(1, page - 1))}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200",
            "bg-white text-[var(--color-neutral-700)] shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-95",
            page <= 1 && "pointer-events-none opacity-40 shadow-none"
          )}
          aria-label="Previous page"
          aria-disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold tabular-nums text-[var(--color-neutral-700)] border border-neutral-200/70">
          {page} / {computedTotalPages}
        </span>
        <Link
          href={href(Math.min(computedTotalPages, page + 1))}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200",
            "bg-white text-[var(--color-neutral-700)] shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-95",
            page >= computedTotalPages && "pointer-events-none opacity-40 shadow-none"
          )}
          aria-label="Next page"
          aria-disabled={page >= computedTotalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

