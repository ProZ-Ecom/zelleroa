"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  AdminCustomerOrderItemDto,
  AdminCustomerListPaginationMeta,
} from "../../types/admin-customer.types";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { DataTable } from "@/components/admin/data-table/DataTable";

interface CustomerOrdersSectionProps {
  orders?: AdminCustomerOrderItemDto[];
  meta?: AdminCustomerListPaginationMeta;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onPageChange?: (page: number) => void;
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

export function CustomerOrdersSection({
  orders = [],
  meta,
  isLoading = false,
  error = null,
  onRetry,
  onPageChange,
}: CustomerOrdersSectionProps) {
  const columns = React.useMemo<ColumnDef<AdminCustomerOrderItemDto>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "ORDER ID",
        cell: ({ row }) => {
          const order = row.original;
          const formattedOrderNumber = order.orderNumber?.startsWith("#")
            ? order.orderNumber
            : `#${order.orderNumber}`;

          return (
            <span className="font-semibold text-neutral-900 font-mono text-xs sm:text-sm">
              {formattedOrderNumber}
            </span>
          );
        },
      },
      {
        accessorKey: "placedAt",
        header: "DATE",
        cell: ({ row }) => {
          const order = row.original;
          return (
            <span className="text-xs sm:text-sm text-neutral-600">
              {formatDate(order.placedAt || order.createdAt)}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "STATUS",
        cell: ({ row }) => (
          <div className="flex items-center">
            {getOrderStatusBadge(row.original.status)}
          </div>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "TOTAL",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-semibold text-neutral-900 font-mono text-xs sm:text-sm">
            {formatAmount(row.original.totalAmount)}
          </span>
        ),
      },
    ],
    []
  );

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

  return (
    <div className="w-full overflow-hidden bg-white">
      <DataTable
        columns={columns}
        data={orders}
        pageSize={10}
        page={meta?.page}
        totalPages={meta?.totalPages}
        totalItems={meta?.total}
        onPageChange={onPageChange}
        emptyMessage="No Orders Placed Yet"
        className="bg-white border-0"
      />
    </div>
  );
}
