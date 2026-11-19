"use client";

import Link from "next/link";
import { ChevronRight, ArrowRight, Package, Calendar } from "lucide-react";
import { formatDateTime, formatPrice, getImageUrl } from "@/lib/utils";
import { ProductImage } from "@/components/common/ProductImage";
import type {
  OrderListItem,
  OrderListItemResponse,
  OrderDetailResponse,
} from "../types";

export type AnyOrderListItem =
  | OrderListItem
  | OrderDetailResponse
  | OrderListItemResponse;

interface OrderCardProps {
  order: AnyOrderListItem;
}

function getStatusBadgeMeta(status?: string) {
  switch (status?.toLowerCase()) {
    case "delivered":
      return {
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "cancelled":
      return {
        bg: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-500",
      };
    case "returned":
      return {
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        dot: "bg-purple-500",
      };
    case "out_for_delivery":
    case "shipped":
      return {
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
      };
    case "packed":
    case "processing":
      return {
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      };
    case "pending":
    case "confirmed":
      return {
        bg: "bg-orange-50 text-orange-700 border-orange-200",
        dot: "bg-orange-500",
      };
    default:
      return {
        bg: "bg-theme-surface-alt text-theme-text-muted border-theme-border",
        dot: "bg-theme-border",
      };
  }
}

export function OrderCard({ order }: OrderCardProps) {
  const anyOrder = order as any;
  const items: any[] = anyOrder.items ?? [];
  const statusMeta = getStatusBadgeMeta(order.status);
  const totalCount = anyOrder.totalItems ?? items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);

  const formattedDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs hover:shadow-md hover:border-theme-border-accent transition-all duration-200 overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-theme-surface-alt border-b border-theme-border-subtle">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-theme-text-muted">
              Order ID
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold text-theme-text-primary">
              {order.orderNumber || `#${String(order.id).slice(0, 8)}`}
            </span>
            {"placedByAgent" in order && order.placedByAgent && (
              <span className="mt-0.5 block text-[10px] font-semibold text-theme-text-subtle">
                Ordered by Sales Partner: {order.placedByAgent.name}
              </span>
            )}
          </div>

          <div>
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-theme-text-muted">
              Placed On
            </span>
            <span className="text-xs sm:text-sm font-semibold text-theme-text-primary flex items-center gap-1 mt-0.5">
              <Calendar className="h-3 w-3 text-theme-text-muted shrink-0" />
              {formattedDate}
            </span>
          </div>

          <div>
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-theme-text-muted">
              Total Amount
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-theme-primary">
              {formatPrice(order.totalAmount)}
            </span>
          </div>

          {totalCount > 0 && (
            <div className="hidden sm:block">
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-theme-text-muted">
                Items
              </span>
              <span className="text-xs sm:text-sm font-semibold text-theme-text-primary">
                {totalCount} {totalCount === 1 ? "item" : "items"}
              </span>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide uppercase ${statusMeta.bg}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
            {String(order.status).replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Ordered Items Breakdown */}
      <div className="px-5 py-4 divide-y divide-theme-border-subtle">
        {items.length > 0 ? (
          items.map((item: any, idx: number) => {
            const imgSrc =
              item.primaryImage ||
              item.image ||
              item.productImage ||
              item.variant?.product_variant_images?.[0]?.image_url ||
              item.product?.images?.[0]?.image_url ||
              null;
            const productName = item.productName || item.product_name_snapshot || "Snack Item";
            const variantName = item.variantName || item.variant_snapshot || "";
            const quantity = item.quantity || 1;
            const unitPrice = item.unitPrice || item.unit_price;
            const totalPrice = item.totalPrice || item.total_price || (unitPrice ? unitPrice * quantity : null);

            return (
              <div
                key={item.id || idx}
                className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0"
              >
                {/* Product Thumbnail with Fallback */}
                <div className="relative h-13 w-13 sm:h-14 sm:w-14 rounded-xl border border-theme-border-subtle bg-theme-surface-alt shrink-0 overflow-hidden">
                  <ProductImage
                    src={imgSrc ? getImageUrl(imgSrc) : null}
                    alt={productName}
                    fallbackText={productName}
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Product & Variant Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-theme-text-primary truncate">
                    {productName}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-theme-text-subtle">
                    {variantName && (
                      <span className="font-medium text-theme-text-secondary">
                        {variantName}
                      </span>
                    )}
                    {variantName && <span>•</span>}
                    <span>Qty: {quantity}</span>
                    {unitPrice && (
                      <>
                        <span>•</span>
                        <span>{formatPrice(unitPrice)} each</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Line Item Total */}
                {totalPrice && (
                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-theme-text-primary">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-3 flex items-center gap-2 text-xs text-theme-text-muted">
            <Package className="h-4 w-4" />
            <span>Order details logged ({totalCount} items)</span>
          </div>
        )}
      </div>

      {/* Card Footer Bar with CTA */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-theme-surface-alt/40 border-t border-theme-border-subtle">
        <div className="text-xs text-theme-text-subtle">
          <span>Total: </span>
          <span className="font-bold text-theme-text-primary">
            {formatPrice(order.totalAmount)}
          </span>
          {anyOrder.paymentStatus && (
            <span className="ml-2 inline-block rounded bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
              {anyOrder.paymentStatus}
            </span>
          )}
        </div>

        <Link
          href={`/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-theme-border bg-theme-surface px-3.5 py-1.5 text-xs font-bold text-theme-primary hover:bg-theme-surface-warm hover:border-theme-border-accent transition-colors shadow-2xs"
        >
          <span>View Details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
