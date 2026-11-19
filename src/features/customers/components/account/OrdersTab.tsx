"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Package, X, CreditCard, Loader2, AlertCircle, Undo2, PackageCheck, Clock, Truck } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { OrderDetailResponse } from "@/features/orders/types";
import { useCustomerOrders, useCancelCustomerOrder } from "../../hooks/use-customer-orders";
import { useAddToCartMutation } from "../../hooks/use-customer-cart";
import { useCreateRazorpayOrder, useVerifyRazorpayPayment } from "../../hooks/use-customer-payment";
import { loadRazorpayScript } from "../../utils/razorpay-loader";
import { CustomDropdown, type DropdownOption } from "./CustomDropdown";
import { SearchInput } from "@/components/common/search-input";
import { ProductImage } from "@/components/common/ProductImage";
import { toast } from "@/components/ui/Toast";
import { CancelOrderDialog } from "@/features/orders/components/CancelOrderDialog";
import { isOrderCancellable, getShipWindow, formatStoreDate } from "@/features/returns/lib/policy";
import { RequestWizard } from "@/features/returns/components/RequestWizard";
import { ShipReturnModal } from "@/features/returns/components/ShipReturnModal";
import type { RequestSummary } from "@/features/returns/lib/summary";

const STATUS_OPTIONS: DropdownOption[] = [
  { value: "all", label: "All Orders" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
];

interface OrdersTabProps {
  orders?: OrderDetailResponse[];
  isLoading?: boolean;
  error?: Error | null;
  onRefetch?: () => void;
}

export function OrdersTab({
  orders: initialOrders = [],
  isLoading: initialLoading,
  error: initialError,
  onRefetch,
}: OrdersTabProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [trackingOrder, setTrackingOrder] = useState<OrderDetailResponse | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderSuccessId, setReorderSuccessId] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<{ orderId: string; message: string } | null>(null);

  const [cancelTarget, setCancelTarget] = useState<OrderDetailResponse | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<{ orderId: string; mode: "return" | "replacement" } | null>(null);
  const [shippingReturn, setShippingReturn] = useState<RequestSummary | null>(null);
  const cancelMutation = useCancelCustomerOrder();
  const addToCartMutation = useAddToCartMutation();
  const createRazorpayOrderMutation = useCreateRazorpayOrder();
  const verifyPaymentMutation = useVerifyRazorpayPayment();

  const {
    data: ordersResponse,
    isLoading: isOrdersLoading,
    isFetching,
    error: ordersQueryError,
    refetch: refetchQuery,
  } = useCustomerOrders({
    page: 1,
    limit: 50,
    sortBy: "createdAt",
    sortOrder: "desc",
    ...(selectedStatus !== "all" ? { status: selectedStatus } : {}),
    ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
  });

  const isFiltered = selectedStatus !== "all" || Boolean(searchQuery.trim());
  const rawOrders = ordersResponse?.data ?? (isFiltered ? [] : initialOrders);

  const orders = React.useMemo(() => {
    let list = rawOrders;
    if (selectedStatus !== "all") {
      list = list.filter((o) => o.status?.toLowerCase() === selectedStatus.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase().replace(/^#/, "");
      list = list.filter((o) => {
        const orderNum = (o.orderNumber || "").toLowerCase();
        const idStr = String(o.id).toLowerCase();
        const matchesOrder = orderNum.includes(q) || idStr.includes(q);
        const matchesItem = o.items?.some((it) =>
          it.productName?.toLowerCase().includes(q)
        );
        return matchesOrder || matchesItem;
      });
    }
    return list;
  }, [rawOrders, selectedStatus, searchQuery]);

  const isLoading = isOrdersLoading || (initialLoading && !ordersResponse) || isFetching;
  const error = ordersQueryError || initialError;

  const handleRefetch = () => {
    refetchQuery();
    onRefetch?.();
  };

  const getStatusMeta = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
      case "cancelled":
        return { bg: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" };
      case "returned":
        return { bg: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" };
      case "out_for_delivery":
      case "shipped":
        return { bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" };
      case "packed":
      case "processing":
        return { bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" };
      case "pending":
      case "confirmed":
        return { bg: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" };
      default:
        return { bg: "bg-theme-surface-alt text-theme-text-muted border-theme-border", dot: "bg-theme-border" };
    }
  };

  const getReturnStatusMeta = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return { label: "Return Approved", bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" };
      case "shipped_by_customer":
        return { label: "Item Shipped", bg: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" };
      case "received":
        return { label: "Return Received", bg: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" };
      case "refund_pending":
        return { label: "Refund Pending", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
      case "refunded":
        return { label: "Refunded", bg: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" };
      case "return_requested":
        return { label: "Return Requested", bg: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" };
      case "under_review":
        return { label: "Return Under Review", bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" };
      case "qc_failed":
        return { label: "QC Failed", bg: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" };
      case "returning_to_customer":
        return { label: "Returning to Customer", bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" };
      case "returned_to_customer":
        return { label: "Returned to Customer", bg: "bg-slate-50 text-slate-700 border-slate-200", dot: "bg-slate-500" };
      case "rejected":
        return { label: "Return Rejected", bg: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" };
      case "cancelled":
        return { label: "Return Cancelled", bg: "bg-neutral-100 text-neutral-700 border-neutral-300", dot: "bg-neutral-400" };
      case "expired":
        return { label: "Return Expired", bg: "bg-neutral-100 text-neutral-700 border-neutral-300", dot: "bg-neutral-400" };
      case "closed":
        return { label: "Return Closed", bg: "bg-neutral-100 text-neutral-600 border-neutral-200", dot: "bg-neutral-400" };
      default:
        return null;
    }
  };

  const getReturnShipDaysLeft = (ret?: RequestSummary | null) => {
    if (!ret || ret.status !== "approved") return null;

    if (ret.shipDeadlineAt) {
      const deadline = new Date(ret.shipDeadlineAt);
      if (!Number.isNaN(deadline.getTime())) {
        const now = new Date();
        const expired = now.getTime() > deadline.getTime();
        const diffMs = deadline.getTime() - now.getTime();
        const daysLeft = expired
          ? 0
          : Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return { daysLeft, expired, deadline };
      }
    }

    if (ret.approvedAt) {
      const sw = getShipWindow(ret.approvedAt);
      return { daysLeft: sw.daysLeft, expired: sw.expired, deadline: sw.deadline };
    }

    const sw = getShipWindow(new Date());
    return { daysLeft: sw.daysLeft, expired: sw.expired, deadline: sw.deadline };
  };

  // 4 Breakpoint Stepper (Placed -> Packed by Admin, Out for Delivery by Staff, Delivered / Returned / Cancelled)
  const getTrackingStepIndex = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
      case "confirmed":
        return 0;
      case "processing":
      case "packed":
        return 1;
      case "shipped":
      case "out_for_delivery":
        return 2;
      case "delivered":
      case "returned":
      case "cancelled":
        return 3;
      default:
        return 0;
    }
  };

  const handleReorder = async (order: OrderDetailResponse) => {
    if (!order.items || order.items.length === 0) {
      toast.error("No items found in this order to reorder.");
      return;
    }
    setReorderingId(order.id);
    let addedCount = 0;
    let lastError: string | null = null;

    try {
      for (const item of order.items) {
        if (!item.variantUnitPriceId && !item.variantId) continue;

        try {
          await addToCartMutation.mutateAsync({
            ...(item.variantUnitPriceId ? { variantUnitPriceId: item.variantUnitPriceId } : {}),
            ...(item.variantId ? { variantId: item.variantId } : {}),
            quantity: item.quantity || 1,
          });
          addedCount++;
        } catch (itemErr: any) {
          lastError = itemErr?.message || "Failed to add item to cart";
          console.error("Failed to reorder item into cart:", itemErr);
        }
      }

      if (addedCount > 0) {
        setReorderSuccessId(order.id);
        toast.success(
          "Added to cart",
          `${addedCount} item${addedCount > 1 ? "s" : ""} added to your cart.`
        );
        router.push("/cart");
      } else {
        toast.error(
          "Could not reorder items",
          lastError || "The ordered items are currently unavailable or out of stock."
        );
      }
    } catch (err: any) {
      console.error("Failed to reorder items into cart:", err);
      toast.error(
        "Could not reorder items",
        err?.message || "Failed to reorder items into cart"
      );
    } finally {
      setReorderingId(null);
    }
  };

  const handlePayOrder = async (order: OrderDetailResponse) => {
    setPaymentError(null);
    setPayingOrderId(order.id);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error(
          "Unable to load Razorpay payment gateway. Please check your internet connection."
        );
      }

      const rzpData = await createRazorpayOrderMutation.mutateAsync({
        orderId: order.id,
      });

      const RazorpayConstructor = (window as any).Razorpay;
      if (!RazorpayConstructor) {
        throw new Error("Razorpay SDK is not available in browser context.");
      }

      const options = {
        key: rzpData.keyId,
        amount: rzpData.amount,
        currency: rzpData.currency || "INR",
        name: "Zellora",
        description: `Order #${order.orderNumber || rzpData.orderNumber}`,
        order_id: rzpData.razorpayOrderId,
        theme: {
          color: "#7A211B",
        },
        config: {
          display: {
            hide: [
              { method: "emi" },
              { method: "paylater" },
            ],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        modal: {
          ondismiss: () => {
            setPayingOrderId(null);
          },
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifyPaymentMutation.mutateAsync({
              orderId: order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setPayingOrderId(null);
            handleRefetch();
            if (trackingOrder?.id === order.id) {
              setTrackingOrder((prev) =>
                prev ? { ...prev, paymentStatus: "paid", status: "confirmed" } : null
              );
            }
          } catch (verifyErr: any) {
            setPayingOrderId(null);
            setPaymentError({
              orderId: order.id,
              message: verifyErr.message || "Payment verification failed. Please contact support.",
            });
          }
        },
      };

      const rzpInstance = new RazorpayConstructor(options);
      rzpInstance.on("payment.failed", (failRes: any) => {
        setPayingOrderId(null);
        setPaymentError({
          orderId: order.id,
          message: failRes.error?.description || "Payment failed. Please try again.",
        });
      });

      rzpInstance.open();
    } catch (err: any) {
      setPayingOrderId(null);
      setPaymentError({
        orderId: order.id,
        message: err.message || "Failed to launch payment checkout. Please try again.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-theme-text-secondary">
            My Orders
          </h2>
          {!isLoading && orders.length > 0 && (
            <p className="text-xs text-theme-text-muted mt-0.5">
              {orders.length} order{orders.length !== 1 ? "s" : ""} found
            </p>
          )}
        </div>
        {/* Filters Row */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="w-full sm:w-56">
            <SearchInput
              value={searchQuery}
              placeholder="Search order number..."
              onSearch={(val) => setSearchQuery(val)}
              debounceMs={400}
            />
          </div>
          <div className="w-full sm:w-44">
            <CustomDropdown
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={STATUS_OPTIONS}
              placeholder="Filter by Status"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        /* Shimmer Loading State */
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-theme-surface border border-theme-border rounded-2xl overflow-hidden animate-pulse"
            >
              <div className="px-5 py-4 bg-theme-surface-alt border-b border-theme-border-subtle flex justify-between items-center">
                <div className="flex gap-6">
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-12 rounded skeleton-shimmer" />
                    <div className="h-4 w-28 rounded skeleton-shimmer" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-10 rounded skeleton-shimmer" />
                    <div className="h-4 w-20 rounded skeleton-shimmer" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-10 rounded skeleton-shimmer" />
                    <div className="h-4 w-16 rounded skeleton-shimmer" />
                  </div>
                </div>
                <div className="h-6 w-20 rounded-full skeleton-shimmer" />
              </div>
              <div className="p-5 space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg skeleton-shimmer flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-40 rounded skeleton-shimmer" />
                      <div className="h-3 w-24 rounded skeleton-shimmer" />
                    </div>
                    <div className="h-4 w-14 rounded skeleton-shimmer" />
                  </div>
                ))}
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
                <div className="h-9 w-20 rounded-lg skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State */
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-8 text-center space-y-4">
          <p className="text-sm text-theme-text-muted">Failed to load your orders.</p>
          <button
            type="button"
            onClick={handleRefetch}
            className="bg-theme-primary text-theme-primary-fg px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        /* Empty State */
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-8 sm:p-14 text-center shadow-2xs overflow-hidden max-w-full">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-theme-surface-alt border-2 border-dashed border-theme-border-accent flex items-center justify-center">
            <Package className="w-9 h-9 text-theme-primary/50" />
          </div>
          <h3 className="text-lg font-bold uppercase tracking-wide text-theme-text-secondary max-w-full break-words [overflow-wrap:anywhere] px-2">
            {searchQuery ? (
              <span>
                No orders matching{" "}
                <span className="text-theme-primary font-black break-all inline">
                  &ldquo;{searchQuery}&rdquo;
                </span>
              </span>
            ) : selectedStatus !== "all" ? (
              `No ${selectedStatus.replace(/_/g, " ")} orders`
            ) : (
              "No orders placed yet"
            )}
          </h3>
          <p className="text-xs sm:text-sm text-theme-text-muted max-w-sm mx-auto mt-3 mb-6 leading-relaxed break-words [overflow-wrap:anywhere]">
            {searchQuery
              ? "Try a different order number or clear your search."
              : selectedStatus !== "all"
              ? `You don't have any orders currently marked as "${selectedStatus.replace(/_/g, " ")}".`
              : "Your wardrobe is waiting. Browse our handcrafted fashion collections and your orders will show up here."}
          </p>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg text-xs font-semibold uppercase tracking-wider py-3.5 px-7 rounded-lg transition-colors cursor-pointer min-h-[44px] inline-flex items-center gap-2"
            >
              <X className="h-3.5 w-3.5" />
              Clear Search
            </button>
          ) : selectedStatus !== "all" ? (
            <button
              type="button"
              onClick={() => setSelectedStatus("all")}
              className="bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg text-xs font-semibold uppercase tracking-wider py-3.5 px-7 rounded-lg transition-colors cursor-pointer min-h-[44px]"
            >
              View All Orders
            </button>
          ) : (
            <Link href="/products">
              <button
                type="button"
                className="bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg text-xs font-semibold uppercase tracking-wider py-3.5 px-7 rounded-lg transition-colors cursor-pointer min-h-[44px]"
              >
                Shop Now
              </button>
            </Link>
          )}
        </div>
      ) : (
        /* Orders List */
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const isOngoing = order.status !== "delivered" && order.status !== "cancelled" && order.status !== "returned";
            const isReordering = reorderingId === order.id;
            const isReordered = reorderSuccessId === order.id;
            const statusMeta = getStatusMeta(order.status);
            const itemCount = order.items?.length ?? 0;

            const activeReturn =
              order.returnRequests?.find((r) =>
                [
                  "return_requested",
                  "under_review",
                  "approved",
                  "shipped_by_customer",
                  "received",
                  "qc_failed",
                  "returning_to_customer",
                  "returned_to_customer",
                  "refund_pending",
                  "refunded",
                ].includes(r.status)
              ) || order.returnRequests?.[0];

            const returnMeta = activeReturn ? getReturnStatusMeta(activeReturn.status) : null;
            const effectiveStatusMeta = returnMeta ?? statusMeta;
            const effectiveStatusLabel = returnMeta?.label ?? order.status.replace(/_/g, " ");
            const shipDaysInfo = activeReturn ? getReturnShipDaysLeft(activeReturn) : null;

            return (
              <div
                key={order.id}
                className="bg-theme-surface border border-theme-border rounded-2xl overflow-hidden shadow-2xs hover:shadow-sm hover:border-theme-border-accent transition-all duration-200"
              >
                {/* Card Header Bar */}
                <div className="flex justify-between items-center gap-4 flex-wrap px-5 py-3.5 bg-theme-surface-alt border-b border-theme-border-subtle">
                  <div className="flex items-center gap-5 sm:gap-7 flex-wrap">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-theme-text-muted">
                        Order
                      </div>
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-xs sm:text-sm font-bold text-theme-text-primary mt-0.5 font-mono hover:text-theme-primary hover:underline transition-colors block"
                        title="View order details"
                      >
                        {order.orderNumber || `#${String(order.id).slice(0, 8)}`}
                      </Link>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-theme-text-muted">
                        Placed
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-theme-text-primary mt-0.5">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "\u2014"}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-theme-text-muted">
                        Total
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-theme-primary mt-0.5">
                        {formatPrice(order.totalAmount)}
                      </div>
                    </div>

                    {itemCount > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-theme-text-muted">
                          Items
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-theme-text-primary mt-0.5">
                          {itemCount}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {activeReturn?.returnNumber && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
                        Return ID: {activeReturn.returnNumber}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border ${effectiveStatusMeta.bg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${effectiveStatusMeta.dot}`} />
                      {effectiveStatusLabel}
                    </span>

                    {/* Time left for customer shipment badge in card header */}
                    {activeReturn?.status === "approved" && shipDaysInfo && (
                      <span
                        suppressHydrationWarning
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-2xs ${
                          shipDaysInfo.expired
                            ? "bg-red-50 text-red-700 border-red-200"
                            : shipDaysInfo.daysLeft <= 1
                            ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                            : "bg-blue-50 text-blue-800 border-blue-200"
                        }`}
                        title={shipDaysInfo.deadline ? `Courier return deadline: ${formatStoreDate(shipDaysInfo.deadline)}` : undefined}
                      >
                        <Clock className="h-3 w-3" />
                        {shipDaysInfo.expired
                          ? "Shipment window expired"
                          : `${shipDaysInfo.daysLeft} ${shipDaysInfo.daysLeft === 1 ? "day" : "days"} left to ship`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Shipment Alert Banner when return is approved */}
                {activeReturn?.status === "approved" && (
                  <div className="mx-5 mt-3.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-950 flex items-start gap-2.5">
                    <Truck className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-blue-950">Return Approved — Please Courier Item</span>
                        {shipDaysInfo && (
                          <span
                            suppressHydrationWarning
                            className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                              shipDaysInfo.expired
                                ? "bg-red-100 text-red-800 font-bold"
                                : shipDaysInfo.daysLeft <= 1
                                ? "bg-amber-100 text-amber-900 font-bold"
                                : "bg-blue-100 text-blue-800 font-bold"
                            }`}
                          >
                            {shipDaysInfo.expired
                              ? "Shipping deadline passed"
                              : `${shipDaysInfo.daysLeft} ${shipDaysInfo.daysLeft === 1 ? "day" : "days"} left to ship${shipDaysInfo.deadline ? ` (by ${formatStoreDate(shipDaysInfo.deadline)})` : ""}`}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-blue-800 mt-1">
                        Please pack the item and courier it to the seller. Then click <strong>&quot;I have shipped the item&quot;</strong> below to enter your tracking details.
                      </p>
                    </div>
                  </div>
                )}

                {/* Ordered Items List */}
                <div className="px-5 py-4 flex flex-col divide-y divide-theme-border-subtle">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((it, idx) => (
                      <div key={idx} className="flex items-center gap-3.5 py-2.5 first:pt-0 last:pb-0">
                        <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden border border-theme-border-subtle">
                          <ProductImage
                            src={it.primaryImage || (it as any).image || null}
                            alt={it.productName || "Fashion Item"}
                            fallbackText={it.productName || "Fashion Item"}
                            containerClassName="w-full h-full"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm font-semibold text-theme-text-primary truncate">
                            {it.productName || "Fashion Item"}
                          </div>
                          <div className="text-[11px] text-theme-text-muted mt-0.5 flex items-center gap-2">
                            {it.quantity && <span>Qty: {it.quantity}</span>}
                            {(it.attributes?.length ? it.attributes.map((a) => `${a.name}: ${a.value}`).join(" | ") : it.variantName) && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-theme-border inline-block" />
                                <span className="truncate">
                                  {it.attributes?.length
                                    ? it.attributes
                                        .filter((a, i, arr) => arr.findIndex((b) => b.value === a.value && b.name.toLowerCase().startsWith("colo") === a.name.toLowerCase().startsWith("colo")) === i)
                                        .map((a) => `${a.name}: ${a.value}`)
                                        .join(" | ")
                                    : it.variantName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-theme-primary flex-shrink-0">
                          {formatPrice(it.totalPrice ?? it.unitPrice ?? 0)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-theme-text-muted py-3">
                      Order details available in invoice.
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="px-5 pb-4 pt-1 flex items-center gap-2.5 flex-wrap border-t border-theme-border-subtle">
                  {/* Pay Now button — ONLY for online payment orders (Card/UPI/Razorpay) when payment is pending */}
                  {(() => {
                    const method = String((order as any).paymentMethod || "").toUpperCase();
                    const paymentDetailsMethod = String((order as any).paymentDetails?.method || "").toUpperCase();
                    const notes = String((order as any).notes || "").toUpperCase();

                    const isCod =
                      method === "COD" ||
                      method.includes("CASH") ||
                      paymentDetailsMethod.includes("COD") ||
                      paymentDetailsMethod.includes("CASH") ||
                      notes.includes("COD") ||
                      notes.includes("CASH ON DELIVERY") ||


                      Boolean((order as any).bankDetails?.accountHolder);
                    const canPay =
                      order.paymentStatus === "pending" &&
                      order.status !== "cancelled" &&
                      !isCod;
                    return canPay;
                  })() && (
                    <button
                      type="button"
                      disabled={payingOrderId === order.id}
                      onClick={() => handlePayOrder(order)}
                      className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-lg transition-colors cursor-pointer min-h-[40px] disabled:opacity-60"
                    >
                      {payingOrderId === order.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-3.5 w-3.5" />
                          Pay Now
                        </>
                      )}
                    </button>
                  )}

                  {isOngoing ? (
                    <button
                      type="button"
                      onClick={() => setTrackingOrder(order)}
                      className="bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-lg transition-colors cursor-pointer min-h-[40px]"
                    >
                      Track Order
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isReordering}
                      onClick={() => handleReorder(order)}
                      className={`text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-lg transition-colors cursor-pointer min-h-[40px] ${
                        isReordered
                          ? "bg-green-600 text-white"
                          : "bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg"
                      } disabled:opacity-50`}
                    >
                      {isReordering ? (
                        "Adding to Cart..."
                      ) : isReordered ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Added to Cart
                        </span>
                      ) : (
                        "Reorder"
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      window.open(`/invoice/${order.id}`, "_blank", "noopener")
                    }
                    className="border border-theme-border hover:bg-theme-surface-alt text-theme-text-subtle text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-lg transition-colors cursor-pointer min-h-[40px]"
                  >
                    Invoice
                  </button>

                  <Link href={`/orders/${order.id}`}>
                    <button
                      type="button"
                      className="border border-theme-border hover:bg-theme-surface-alt text-theme-text-subtle text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-lg transition-colors cursor-pointer min-h-[40px]"
                    >
                      View Details
                    </button>
                  </Link>

                  {order.status === "delivered" && (
                    order.returnWindow && !order.returnWindow.eligible ? (
                      <span
                        className="border border-theme-border bg-theme-surface-alt text-theme-text-muted text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-lg inline-flex items-center gap-1.5 cursor-not-allowed select-none opacity-70"
                        title="Return period expired (only allowed within 3 days of delivery)"
                      >
                        <Undo2 className="h-3.5 w-3.5 text-theme-text-muted" />
                        Return Expired (3-Day Limit)
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setReturnTarget({ orderId: order.id, mode: "return" })
                        }
                        className="btn-return-replace text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-lg cursor-pointer min-h-[40px] inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Undo2 className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>Return / Replace</span>
                        {order.returnWindow?.daysLeft ? (
                          <span className="return-badge ml-1 rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-normal">
                            {order.returnWindow.daysLeft}d left
                          </span>
                        ) : null}
                      </button>
                    )
                  )}

                  {/* "I have shipped the item" button shown after return/replace button, ONLY when return status is approved */}
                  {activeReturn?.status === "approved" && (
                    <button
                      type="button"
                      onClick={() => setShippingReturn(activeReturn)}
                      className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-lg transition-colors cursor-pointer min-h-[40px] shadow-xs"
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                      <span>I have shipped the item</span>
                      {shipDaysInfo && (
                        <span
                          suppressHydrationWarning
                          className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-normal ${
                            shipDaysInfo.expired
                              ? "bg-red-500 text-white"
                              : shipDaysInfo.daysLeft <= 1
                              ? "bg-amber-400 text-amber-950 font-black"
                              : "bg-white/25 text-white"
                          }`}
                        >
                          {shipDaysInfo.expired ? "Expired" : `${shipDaysInfo.daysLeft}d left`}
                        </span>
                      )}
                    </button>
                  )}

                  <Link href="/contact">
                    <button
                      type="button"
                      className="border border-theme-border hover:bg-theme-surface-alt text-theme-text-subtle text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-lg transition-colors cursor-pointer min-h-[40px]"
                    >
                      Need Help
                    </button>
                  </Link>

                  {isOrderCancellable(order.status) && (
                    <button
                      type="button"
                      disabled={cancelMutation.isPending}
                      onClick={() => {
                        setCancelError(null);
                        setCancelTarget(order);
                      }}
                      className="border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-lg transition-colors cursor-pointer min-h-[40px] disabled:opacity-50 ml-auto"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>

                {/* Payment error banner - only shown on the specific order that failed */}
                {paymentError && paymentError.orderId === order.id && payingOrderId === null && (
                  <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-start gap-2 text-xs text-red-700">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-red-500" />
                    <span>{paymentError.message}</span>
                    <button
                      type="button"
                      onClick={() => setPaymentError(null)}
                      className="ml-auto text-red-400 hover:text-red-600 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Live Interactive Order Tracking Modal */}
      {trackingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-theme-surface border border-theme-border rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-theme-border-subtle pb-4">
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-theme-text-muted">
                  Live Shipment Tracking
                </div>
                <h3 className="text-lg font-bold text-theme-text-primary mt-0.5">
                  Order {trackingOrder.orderNumber || `#${String(trackingOrder.id).slice(0, 8)}`}
                </h3>
                {(() => {
                  const m = getStatusMeta(trackingOrder.status);
                  return (
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border mt-1 ${m.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                      {trackingOrder.status.replace(/_/g, " ")}
                    </span>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => setTrackingOrder(null)}
                className="w-8 h-8 rounded-full border border-theme-border flex items-center justify-center text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-surface-alt transition-colors cursor-pointer flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Stepper Visual (4 Breakpoints: Placed -> Packed -> Out for Delivery -> Delivered / Returned / Cancelled) */}
            {(() => {
              const isDelivered = trackingOrder.status?.toLowerCase() === "delivered";
              const isReturned = trackingOrder.status?.toLowerCase() === "returned";
              const isCancelled = trackingOrder.status?.toLowerCase() === "cancelled";

              const finalStepLabel = isReturned
                ? "Returned"
                : isCancelled
                ? "Cancelled"
                : "Delivered";

              const finalStepStage = isReturned
                ? "Store"
                : isCancelled
                ? "Order"
                : "Staff";

              const finalStepDesc = isDelivered
                ? "Delivered successfully"
                : isReturned
                ? "Returned & Refunded"
                : isCancelled
                ? "Order Cancelled"
                : "Expected soon";

              const modalSteps = [
                {
                  label: "Placed",
                  desc: trackingOrder.createdAt
                    ? new Date(trackingOrder.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                    : "Received",
                  isCancel: false,
                  isReturn: false,
                },
                {
                  label: "Packed",
                  desc:
                    getTrackingStepIndex(trackingOrder.status) >= 1
                      ? trackingOrder.status === "packed"
                        ? "Packed & Ready"
                        : "Processing"
                      : "Pending",
                  isCancel: false,
                  isReturn: false,
                },
                {
                  label: "Out for Delivery",
                  desc:
                    getTrackingStepIndex(trackingOrder.status) >= 2
                      ? trackingOrder.status === "out_for_delivery"
                        ? "On the way"
                        : "Dispatched"
                      : "Pending",
                  isCancel: false,
                  isReturn: false,
                },
                {
                  label: finalStepLabel,
                  desc: finalStepDesc,
                  isCancel: isCancelled,
                  isReturn: isReturned,
                },
              ];

              const currentStep = getTrackingStepIndex(trackingOrder.status);

              return (
                <div className="bg-theme-surface-alt rounded-xl p-4 sm:p-5 border border-theme-border-subtle">
                  <div className="grid grid-cols-4 gap-0 items-start">
                    {modalSteps.map((step, idx) => {
                      const isDone = idx <= currentStep;
                      const isActive = idx === currentStep;
                      const isLast = idx === modalSteps.length - 1;

                      const dotColor =
                        isLast && step.isCancel
                          ? "bg-red-500 ring-2 ring-red-100"
                          : isLast && step.isReturn
                          ? "bg-purple-600 ring-2 ring-purple-100"
                          : isDone
                          ? "bg-emerald-500 ring-2 ring-emerald-100"
                          : isActive
                          ? "bg-theme-secondary ring-2 ring-theme-secondary/20"
                          : "bg-theme-border";

                      const lineColor = idx < currentStep ? "bg-emerald-400" : "bg-theme-border";

                      return (
                        <div key={step.label} className="flex flex-col gap-1.5 sm:gap-2 min-w-0">
                          <div className="flex items-center">
                            <span
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex-shrink-0 transition-all ${dotColor}`}
                            />
                            {!isLast && (
                              <span className={`h-0.5 flex-1 transition-colors ${lineColor}`} />
                            )}
                          </div>
                          <div
                            className={`text-[11px] sm:text-xs font-semibold leading-tight pr-0.5 truncate ${
                              isDone || isActive ? "text-theme-text-primary" : "text-theme-text-muted"
                            }`}
                            title={step.label}
                          >
                            {step.label}
                          </div>
                          <div className="text-[9px] sm:text-[10px] text-theme-text-muted pr-0.5 line-clamp-2">
                            {step.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Delivery Address Snapshot */}
            {trackingOrder.shippingAddress && (
              <div className="space-y-1.5 text-xs bg-theme-surface-warm p-4 rounded-xl border border-theme-border-subtle">
                <div className="font-semibold text-theme-text-primary uppercase tracking-wider text-[11px]">
                  Delivery Address
                </div>
                <div className="text-theme-text-primary font-medium">
                  {trackingOrder.shippingAddress.fullName || trackingOrder.shippingAddress.addressLine1}
                </div>
                <div className="text-theme-text-muted">
                  {[
                    trackingOrder.shippingAddress.addressLine1,
                    trackingOrder.shippingAddress.addressLine2,
                    trackingOrder.shippingAddress.city,
                    trackingOrder.shippingAddress.state,
                    trackingOrder.shippingAddress.pincode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              </div>
            )}

            {/* Items Summary in Modal */}
            <div className="space-y-2">
              <div className="font-semibold text-xs text-theme-text-muted uppercase tracking-wider">
                Order Items ({trackingOrder.items?.length || 0})
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {trackingOrder.items?.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2 border-b border-theme-border-subtle last:border-0">
                    <div className="w-9 h-9 rounded-lg overflow-hidden border border-theme-border-subtle flex-shrink-0">
                      <ProductImage
                        src={it.primaryImage || (it as any).image || null}
                        alt={it.productName || "Fashion Item"}
                        fallbackText={it.productName}
                        containerClassName="w-full h-full"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-xs text-theme-text-primary font-medium flex-1 truncate">
                      {it.productName} {it.attributes?.length ? `(${it.attributes.map((a) => a.value).filter((v, i, r) => r.indexOf(v) === i).join(", ")})` : it.variantName ? `(${it.variantName})` : ""} × {it.quantity}
                    </span>
                    <span className="font-semibold text-xs text-theme-primary flex-shrink-0">
                      {formatPrice(it.totalPrice ?? it.unitPrice ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTrackingOrder(null)}
                className="bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg text-xs font-semibold uppercase tracking-wider py-2.5 px-6 rounded-lg transition-colors cursor-pointer min-h-[40px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <CancelOrderDialog
          open
          orderNumber={cancelTarget.orderNumber}
          isPaid={cancelTarget.paymentStatus === "paid"}
          isSubmitting={cancelMutation.isPending}
          serverError={cancelError}
          onClose={() => setCancelTarget(null)}
          onConfirm={(payload) =>
            cancelMutation.mutate(
              { uuid: cancelTarget.id, payload },
              {
                onSuccess: () => {
                  toast.success("Order cancelled successfully.");
                  setCancelTarget(null);
                },
                onError: (err) => {
                  const msg = err instanceof Error ? err.message : "Could not cancel the order.";
                  setCancelError(msg);
                  toast.error("Could not cancel order", msg);
                },
              }
            )
          }
        />
      )}

      {returnTarget && (
        <RequestWizard
          open
          orderUuid={returnTarget.orderId}
          initialMode={returnTarget.mode}
          onClose={() => {
            setReturnTarget(null);
            handleRefetch();
          }}
        />
      )}

      {shippingReturn && (
        <ShipReturnModal
          open={Boolean(shippingReturn)}
          request={shippingReturn}
          onClose={() => setShippingReturn(null)}
          onSuccess={() => {
            setShippingReturn(null);
            handleRefetch();
          }}
        />
      )}
    </div>
  );
}
