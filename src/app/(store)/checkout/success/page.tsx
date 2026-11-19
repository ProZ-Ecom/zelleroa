"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Package,
  ArrowRight,
  ShoppingBag,
  Clock,
  MapPin,
  CreditCard,
  Sparkles,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { useCustomerOrderDetail } from "@/features/customers/hooks/use-customer-orders";

function SuccessSkeleton() {
  return (
    <div className="container mx-auto px-4 py-10 sm:py-14 max-w-3xl animate-pulse space-y-6">
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="h-16 w-16 rounded-full skeleton-shimmer" />
        <div className="h-8 w-64 rounded-xl skeleton-shimmer" />
        <div className="h-4 w-96 rounded-lg skeleton-shimmer" />
      </div>
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 space-y-4">
        <div className="h-6 w-40 rounded-md skeleton-shimmer" />
        <div className="h-20 rounded-xl skeleton-shimmer" />
        <div className="h-20 rounded-xl skeleton-shimmer" />
      </div>
    </div>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const rawOrderId = searchParams.get("orderId");
  const rawOrderNumber = searchParams.get("orderNumber");

  const orderId =
    rawOrderId && rawOrderId !== "undefined" && rawOrderId !== "null"
      ? rawOrderId.trim()
      : "";
  const orderNumberParam =
    rawOrderNumber && rawOrderNumber !== "undefined" && rawOrderNumber !== "null"
      ? rawOrderNumber.trim()
      : "";

  // Query by orderId or orderNumber safely
  const queryIdentifier = orderId || orderNumberParam;

  const {
    data: order,
    isLoading,
    error,
  } = useCustomerOrderDetail(queryIdentifier);

  if (isLoading && queryIdentifier) {
    return <SuccessSkeleton />;
  }

  // If there's an error or no order detail yet, show graceful fallback with order number
  const displayOrderNumber =
    order?.orderNumber ||
    orderNumberParam ||
    (orderId ? `#${orderId.slice(0, 8)}` : "Order Placed");

  return (
    <div className="container mx-auto px-4 py-10 sm:py-14 max-w-3xl">
      {/* Header Congratulations */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100/80 border-2 border-emerald-300 text-emerald-600 shadow-sm animate-in zoom-in-75 duration-300">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-theme-surface-alt border border-theme-border px-3 py-1 text-xs font-bold text-theme-primary mb-2">
          <Sparkles className="h-3.5 w-3.5 text-theme-secondary" />
          Handcrafted Fashion On Its Way
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-theme-text-primary">
          Order Placed Successfully!
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-theme-text-subtle max-w-md mx-auto">
          Thank you for choosing Zellora. Your order has been confirmed and
          our team is carefully packing your curated selections.
        </p>
      </div>

      {/* Main Order Card */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-xs overflow-hidden mb-6">
        {/* Card Header */}
        <div className="border-b border-theme-border-subtle bg-theme-surface-alt px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-theme-secondary" />
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text-subtle">
              Order Reference
            </span>
          </div>
          <span className="font-mono text-sm sm:text-base font-extrabold text-theme-primary">
            #{displayOrderNumber}
          </span>
        </div>

        {/* Card Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Status & Payment Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-theme-border-subtle bg-theme-surface-alt/40 p-3.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted block mb-1">
                Order Status
              </span>
              <span className="inline-flex items-center rounded-md bg-theme-status-del-bg px-2 py-0.5 text-xs font-bold text-theme-status-del-fg">
                {order?.status ? order.status.toUpperCase() : "CONFIRMED"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted block mb-1">
                Payment Status
              </span>
              <span className="inline-flex items-center rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold">
                {order?.paymentStatus ? order.paymentStatus.toUpperCase() : "PAID"}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted block mb-1">
                Order Placed At
              </span>
              <span className="text-xs font-semibold text-theme-text-primary">
                {order?.createdAt ? formatDateTime(order.createdAt) : "Just now"}
              </span>
            </div>
          </div>

          {/* Delivery Address Snapshot */}
          {order?.shippingAddress && (
            <div className="rounded-xl border border-theme-border-subtle p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-theme-text-primary mb-1">
                <MapPin className="h-3.5 w-3.5 text-theme-secondary" />
                <span>Delivery Address</span>
              </div>
              <p className="text-xs font-semibold text-theme-text-primary">
                {order.shippingAddress.fullName}
              </p>
              <p className="text-xs text-theme-text-subtle">
                {order.shippingAddress.addressLine1}
                {order.shippingAddress.addressLine2
                  ? `, ${order.shippingAddress.addressLine2}`
                  : ""}
              </p>
              <p className="text-xs text-theme-text-subtle">
                {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
                {order.shippingAddress.pincode}
              </p>
              <p className="text-xs text-theme-text-muted flex items-center gap-1 pt-1">
                <Phone className="h-3 w-3" />
                {order.shippingAddress.phone}
              </p>
            </div>
          )}

          {/* Order Items Breakdown */}
          {order?.items && order.items.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-subtle">
                Items In This Order ({order.items.length})
              </h3>
              <div className="divide-y divide-theme-border-subtle">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-theme-text-primary">
                        {item.productName}
                      </span>
                      <span className="text-theme-text-subtle ml-1">
                        ({item.variantName})
                      </span>
                      <div className="text-[11px] text-theme-text-muted">
                        Qty: {item.quantity} × {formatPrice(item.unitPrice)}
                      </div>
                    </div>
                    <span className="font-bold text-theme-text-primary shrink-0">
                      {formatPrice(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals Summary */}
          {order && (
            <div className="border-t border-theme-border pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-theme-text-subtle">
                <span>Subtotal</span>
                <span className="font-semibold text-theme-text-primary">
                  {formatPrice(order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-theme-text-subtle items-center">
                <div className="flex items-center gap-1.5">
                  <span>Shipping & Delivery</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-theme-surface-alt border border-theme-border text-theme-text-muted uppercase">
                    {order.shippingCharge === 99 ? "Express" : "Standard"}
                  </span>
                </div>
                <span className="font-semibold text-theme-text-primary">
                  {order.shippingCharge === 0 ? "FREE" : formatPrice(order.shippingCharge)}
                </span>
              </div>
              <div className="border-t border-theme-border-subtle pt-2 flex justify-between items-baseline text-sm font-bold text-theme-text-primary">
                <span>Total Paid</span>
                <span className="text-lg font-extrabold text-theme-primary">
                  {formatPrice(order.totalAmount)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/orders" className="flex-1">
          <Button
            variant="outline"
            className="w-full min-h-[44px] rounded-xl border-theme-border text-theme-text-primary font-bold hover:bg-theme-surface-alt"
          >
            <Package className="mr-2 h-4 w-4 text-theme-secondary" />
            View Order History
          </Button>
        </Link>
        <Link href="/products" className="flex-1">
          <Button className="w-full min-h-[44px] rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-white font-bold shadow-xs">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Continue Shopping
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessSkeleton />}>
      <SuccessContent />
    </Suspense>
  );
}
