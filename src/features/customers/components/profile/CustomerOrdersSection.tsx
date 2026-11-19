"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import type {
  AdminCustomerOrderItemDto,
  AdminCustomerListPaginationMeta,
} from "../../types/admin-customer.types";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

interface CustomerOrdersSectionProps {
  orders?: AdminCustomerOrderItemDto[];
  meta?: AdminCustomerListPaginationMeta;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onPageChange?: (page: number) => void;
}

export function CustomerOrdersSection({
  orders = [],
  meta,
  isLoading = false,
  error = null,
  onRetry,
  onPageChange,
}: CustomerOrdersSectionProps) {
  if (isLoading) {
    return <LoadingState text="Loading customer order history..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message || "Failed to load customer order history"}
        onRetry={onRetry}
      />
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          <Package className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-neutral-900">
          No Orders Placed Yet
        </h3>
        <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
          This customer has not completed any orders in the store yet.
        </p>
      </div>
    );
  }

  const getOrderStatusBadge = (status: string) => {
    const s = status?.toUpperCase() || "";
    if (s === "DELIVERED") {
      return (
        <span className="inline-flex items-center justify-center px-3.5 py-0.5 rounded-full text-xs font-medium bg-success-50 text-success-700">
          Delivered
        </span>
      );
    }
    if (s === "RETURNED") {
      return (
        <span className="inline-flex items-center justify-center px-3.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
          Returned
        </span>
      );
    }
    if (s === "CANCELLED") {
      return (
        <span className="inline-flex items-center justify-center px-3.5 py-0.5 rounded-full text-xs font-medium bg-error-50 text-error-700">
          Cancelled
        </span>
      );
    }
    if (s === "SHIPPED") {
      return (
        <span className="inline-flex items-center justify-center px-3.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          Shipped
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center px-3.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 capitalize">
        {status ? status.toLowerCase() : "Processing"}
      </span>
    );
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatAmount = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="w-full overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-cream-border-subtle bg-cream-50/50">
              <th className="py-3 sm:py-4 px-3.5 sm:px-6 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
                Order ID
              </th>
              <th className="py-3 sm:py-4 px-3.5 sm:px-6 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
                Date
              </th>
              <th className="py-3 sm:py-4 px-3.5 sm:px-6 text-center text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
                Status
              </th>
              <th className="py-3 sm:py-4 px-3.5 sm:px-6 text-right text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-border-subtle">
            {orders.map((order) => {
              const formattedOrderNumber = order.orderNumber?.startsWith("#")
                ? order.orderNumber
                : `#${order.orderNumber}`;

              return (
                <tr
                  key={order.id}
                  className="hover:bg-neutral-50/60 transition-colors"
                >
                  {/* Order ID */}
                  <td className="py-3 sm:py-4 px-3.5 sm:px-6 whitespace-nowrap">
                    <span className="font-semibold text-neutral-900 font-mono text-xs sm:text-sm">
                      {formattedOrderNumber}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="py-3 sm:py-4 px-3.5 sm:px-6 whitespace-nowrap text-xs sm:text-sm text-neutral-600">
                    {formatDate(order.placedAt || order.createdAt)}
                  </td>

                  {/* Status */}
                  <td className="py-3 sm:py-4 px-3.5 sm:px-6 whitespace-nowrap text-center">
                    {getOrderStatusBadge(order.status)}
                  </td>

                  {/* Total */}
                  <td className="py-3 sm:py-4 px-3.5 sm:px-6 whitespace-nowrap text-right text-xs sm:text-sm font-semibold text-neutral-900 font-mono">
                    {formatAmount(order.totalAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {meta && meta.total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-2.5 flex-shrink-0 border-t border-neutral-200/70 bg-neutral-50/95 backdrop-blur sticky bottom-0 z-20">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm text-[var(--color-neutral-500)]">
            <p>
              Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => onPageChange?.(meta.page - 1)}
              disabled={meta.page <= 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-[var(--color-neutral-700)] shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold tabular-nums text-[var(--color-neutral-700)] border border-neutral-200/70">
              {meta.page} / {Math.max(1, meta.totalPages)}
            </span>
            <button
              type="button"
              onClick={() => onPageChange?.(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-[var(--color-neutral-700)] shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
