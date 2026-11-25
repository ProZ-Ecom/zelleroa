"use client";

import * as React from "react";
import Image from "next/image";
import { ShoppingCart, Package } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminCustomerCartDto } from "../../types/admin-customer.types";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { DataTable } from "@/components/admin/data-table/DataTable";

interface CustomerCartSectionProps {
  cart?: AdminCustomerCartDto | any | null;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

function formatMeasurement(m: any): string {
  if (!m) return "—";
  if (typeof m === "string") return m;
  if (typeof m === "object" && "value" in m && "unit" in m) {
    return `${m.value} ${m.unit}`.trim() || "—";
  }
  return "—";
}

export function CustomerCartSection({
  cart,
  isLoading = false,
  error = null,
  onRetry,
}: CustomerCartSectionProps) {
  const items: any[] = cart?.items || [];
  const isEmpty = items.length === 0;

  const columns = React.useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "itemDetails",
        header: "ITEM DETAILS",
        cell: ({ row }) => {
          const item = row.original;
          const productName = item.productName || "Product";
          const variantName = item.variantName || "";
          const primaryImage = item.primaryImage || null;

          return (
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-lg border border-cream-border bg-cream-50 overflow-hidden flex items-center justify-center shrink-0">
                {primaryImage ? (
                  <Image
                    src={primaryImage}
                    alt={productName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <Package className="h-5 w-5 text-neutral-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-neutral-900 leading-snug truncate">
                  {productName}
                </p>
                {variantName && (
                  <p className="text-xs text-neutral-500 truncate">
                    Variant: <span className="font-medium text-neutral-700">{variantName}</span>
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-neutral-500">
            {row.original.sku || "—"}
          </span>
        ),
      },
      {
        id: "measurement",
        header: "MEASUREMENT",
        cell: ({ row }) => {
          const measurementStr = formatMeasurement(row.original.measurement);
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-cream-100 text-neutral-700">
              {measurementStr}
            </span>
          );
        },
      },
      {
        id: "unitPrice",
        header: "UNIT PRICE",
        meta: { align: "right" },
        cell: ({ row }) => {
          const item = row.original;
          const unitPrice =
            typeof item.unitPrice === "number"
              ? item.unitPrice
              : typeof item.currentPrice === "number"
              ? item.currentPrice
              : 0;

          return (
            <span className="whitespace-nowrap font-medium text-neutral-700 font-mono">
              ₹{unitPrice.toLocaleString("en-IN")}
            </span>
          );
        },
      },
      {
        id: "quantity",
        header: "QTY",
        meta: { align: "center" },
        cell: ({ row }) => {
          const quantity = Number(row.original.quantity) || 1;
          return (
            <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-cream-100 text-xs font-bold text-neutral-800">
              {quantity}
            </span>
          );
        },
      },
      {
        id: "totalPrice",
        header: "ITEM TOTAL",
        meta: { align: "right" },
        cell: ({ row }) => {
          const item = row.original;
          const unitPrice =
            typeof item.unitPrice === "number"
              ? item.unitPrice
              : typeof item.currentPrice === "number"
              ? item.currentPrice
              : 0;
          const quantity = Number(item.quantity) || 1;
          const totalPrice =
            typeof item.totalPrice === "number"
              ? item.totalPrice
              : typeof item.itemTotal === "number"
              ? item.itemTotal
              : unitPrice * quantity;

          return (
            <span className="whitespace-nowrap font-bold text-secondary-600 font-mono">
              ₹{totalPrice.toLocaleString("en-IN")}
            </span>
          );
        },
      },
    ],
    []
  );

  if (isLoading) {
    return <LoadingState text="Loading customer cart..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message || "Failed to load customer cart"}
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <div className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          <ShoppingCart className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-neutral-900">
          Cart is empty
        </h3>
        <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
          This customer does not have any items currently saved in their active cart.
        </p>
      </div>
    );
  }

  const calculatedSubtotal =
    typeof cart?.subtotal === "number"
      ? cart.subtotal
      : items.reduce(
          (sum, item) =>
            sum +
            Number(
              item.totalPrice ??
                item.itemTotal ??
                item.quantity * (item.unitPrice ?? item.currentPrice ?? 0)
            ),
          0
        );

  const calculatedTotalItems =
    typeof cart?.totalItems === "number"
      ? cart.totalItems
      : items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <div className="w-full overflow-hidden bg-white">
      {/* Subtotal Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-cream-border-subtle bg-cream-50">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 font-mono">
            Active Cart Items
          </h4>
          <p className="text-xs text-neutral-500">
            {calculatedTotalItems} total quantity across {items.length} unique variant{items.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 font-medium">Cart Subtotal:</span>
          <span className="text-sm sm:text-base font-bold text-secondary-600 font-mono">
            ₹{calculatedSubtotal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Cart Items Table */}
      <DataTable
        columns={columns}
        data={items}
        pageSize={Math.max(10, items.length)}
        emptyMessage="Cart is empty"
        className="bg-white border-0"
      />
    </div>
  );
}
