"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { CustomerProfileResponse } from "../../types";
import type { OrderDetailResponse } from "@/features/orders/types";
import { useAddToCartMutation } from "../../hooks/use-customer-cart";
import { ProfileCompletionMeter } from "@/components/ui/ProfileCompletionMeter";
import { calculateCustomerCompletion } from "../../lib/profile-completion";

interface DashboardTabProps {
  profile?: CustomerProfileResponse | null;
  orders?: OrderDetailResponse[];
  wishlistCount?: number;
  isLoading?: boolean;
  onNavigateTab: (tab: string) => void;
  onAddToCart?: (productId: number) => void;
}

export function DashboardTab({
  profile,
  orders = [],
  wishlistCount = 0,
  isLoading = false,
  onNavigateTab,
}: DashboardTabProps) {
  const userName = profile?.name || "Customer";
  const addToCartMutation = useAddToCartMutation();
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 min-w-0 animate-pulse">
        {/* Banner Shimmer */}
        <div className="bg-gradient-to-r from-theme-primary/80 via-theme-primary to-[#8C2A1E]/80 rounded-2xl p-6 sm:p-7 shadow-xs">
          <div className="space-y-3">
            <div className="h-3.5 w-24 bg-white/20 rounded-md" />
            <div className="h-8 w-56 bg-white/30 rounded-md" />
            <div className="h-4 w-80 bg-white/20 rounded-md" />
          </div>
        </div>

        {/* 4 Stats Cards Shimmer */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3"
            >
              <div className="h-7 w-16 bg-theme-border rounded-md" />
              <div className="h-3.5 w-24 bg-theme-border-subtle rounded-md" />
            </div>
          ))}
        </div>

        {/* Current Order Stepper Shimmer */}
        <div className="bg-theme-surface border border-theme-border rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-theme-border-subtle bg-theme-surface-alt flex justify-between items-center">
            <div className="h-4 w-32 bg-theme-border rounded-md" />
            <div className="h-3 w-20 bg-theme-border-subtle rounded-md" />
          </div>
          <div className="p-5 sm:p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <div className="h-4 w-40 bg-theme-border rounded-md" />
                <div className="h-3 w-56 bg-theme-border-subtle rounded-md" />
              </div>
              <div className="h-6 w-24 bg-theme-border rounded-full" />
            </div>
            <div className="grid grid-cols-4 gap-0 items-start pt-2">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex flex-col gap-2">
                  <div className="flex items-center">
                    <span className="w-3.5 h-3.5 rounded-full bg-theme-border flex-shrink-0" />
                    {step < 4 && <span className="h-0.5 flex-1 bg-theme-border" />}
                  </div>
                  <div className="h-3 w-16 bg-theme-border rounded-md" />
                  <div className="h-2.5 w-12 bg-theme-border-subtle rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Buy Again Shimmer */}
        <div className="bg-theme-surface border border-theme-border rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-theme-border-subtle bg-theme-surface-alt">
            <div className="h-4 w-28 bg-theme-border rounded-md" />
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="border border-theme-border-subtle rounded-xl overflow-hidden bg-theme-surface-warm p-4 space-y-3"
              >
                <div className="h-28 bg-theme-border rounded-lg" />
                <div className="h-4 w-3/4 bg-theme-border rounded-md" />
                <div className="h-4 w-1/3 bg-theme-border-subtle rounded-md" />
                <div className="h-9 w-full bg-theme-border rounded-md mt-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const completion = calculateCustomerCompletion(
    profile ?? ({} as CustomerProfileResponse)
  );

  // Calculate live statistics
  const totalOrdersCount = orders.length;
  const lifetimeSpend = orders.reduce((sum, order) => {
    const val = typeof order.totalAmount === "number" ? order.totalAmount : Number(order.totalAmount || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Find all active / in-progress orders (delivered, cancelled, and returned are excluded)
  const activeOrdersToDisplay = orders.filter(
    (o) =>
      o.status !== "delivered" &&
      o.status !== "cancelled" &&
      o.status !== "returned"
  );

  // Extract past ordered items for "Buy Again"
  const pastItemsMap = new Map<string, { variantId?: string; name: string; price: number }>();
  orders.forEach((o) => {
    o.items?.forEach((item) => {
      const key = item.productName || "";
      const vId = item.variantId ? String(item.variantId) : undefined;
      if (key && !pastItemsMap.has(key)) {
        pastItemsMap.set(key, {
          variantId: vId,
          name: key,
          price: typeof item.unitPrice === "number" ? item.unitPrice : Number(item.unitPrice || 0),
        });
      }
    });
  });
  const buyAgainItems = Array.from(pastItemsMap.values()).slice(0, 4);

  const handleBuyAgain = async (item: { variantId?: string; name: string; price: number }) => {
    if (!item.variantId) {
      onNavigateTab("orders");
      return;
    }
    setAddingVariantId(item.variantId);
    try {
      await addToCartMutation.mutateAsync({
        variantId: item.variantId,
        quantity: 1,
      });
      setAddedVariantId(item.variantId);
      setTimeout(() => setAddedVariantId(null), 3000);
    } catch (err) {
      console.error("Failed to add to cart:", err);
      onNavigateTab("orders");
    } finally {
      setAddingVariantId(null);
    }
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

  const getStatusBadgeClasses = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return "bg-theme-status-del-bg text-theme-status-del-fg";
      case "out_for_delivery":
      case "shipped":
        return "bg-blue-100 text-blue-800";
      case "packed":
      case "processing":
        return "bg-amber-100 text-amber-800";
      case "pending":
      case "confirmed":
        return "bg-orange-100 text-orange-800";
      case "cancelled":
        return "bg-theme-status-can-bg text-theme-status-can-fg";
      case "returned":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-theme-status-out-bg text-theme-status-out-fg";
    }
  };

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-theme-primary via-theme-primary-hover to-[#8C2A1E] rounded-2xl p-6 sm:p-7 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xs">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-theme-secondary font-medium">
            Welcome back
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-wide text-white">
            {userName}
          </h2>
          <p className="text-xs sm:text-sm text-theme-text-gold font-light max-w-lg leading-relaxed">
            {activeOrdersToDisplay.length > 0
              ? `You have ${activeOrdersToDisplay.length} orders in tracking and active loyalty rewards ready to use.`
              : "Manage your profile, browse your orders, and explore curated fashion collections."}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {orders.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab("orders")}
              className="bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg text-xs font-semibold uppercase tracking-wider py-3 px-5 rounded-lg transition-colors cursor-pointer min-h-[44px]"
            >
              View All Orders ({orders.length})
            </button>
          )}
        </div>
      </div>

      {/* Profile completion — derived from live profile data, refreshes when the profile query updates */}
      {profile && (
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 shadow-2xs">
          <ProfileCompletionMeter
            percent={completion.percent}
            missing={completion.missing}
            action={
              <button
                type="button"
                onClick={() => onNavigateTab("profile")}
                className="bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg text-xs font-semibold uppercase tracking-wider py-3 px-5 rounded-lg transition-colors cursor-pointer min-h-[44px] w-full sm:w-auto"
              >
                Complete Profile
              </button>
            }
          />
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="text-2xl sm:text-3xl font-bold text-theme-primary">
            {totalOrdersCount}
          </div>
          <div className="text-xs text-theme-text-muted mt-1.5 font-medium">
            Orders placed
          </div>
        </div>

        <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="text-2xl sm:text-3xl font-bold text-theme-primary">
            {formatPrice(lifetimeSpend)}
          </div>
          <div className="text-xs text-theme-text-muted mt-1.5 font-medium">
            Lifetime spend
          </div>
        </div>

        <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="text-2xl sm:text-3xl font-bold text-theme-primary">
            {profile?.referralCode ? "Active" : "Standard"}
          </div>
          <div className="text-xs text-theme-text-muted mt-1.5 font-medium">
            Member Status
          </div>
        </div>

        <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="text-2xl sm:text-3xl font-bold text-theme-primary">
            {wishlistCount}
          </div>
          <div className="text-xs text-theme-text-muted mt-1.5 font-medium">
            Wishlist items
          </div>
        </div>
      </div>

      {/* Current Orders Tracker Cards (Shows multiple active/recent orders) */}
      {activeOrdersToDisplay.length > 0 && (
        <div className="bg-theme-surface border border-theme-border rounded-2xl overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-theme-border-subtle bg-theme-surface-alt">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-theme-text-secondary flex items-center gap-2">
              <span>Current Orders</span>
              <span className="rounded-full bg-theme-primary/10 text-theme-primary text-xs px-2.5 py-0.5 font-bold">
                {activeOrdersToDisplay.length}
              </span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab("orders")}
              className="text-xs font-semibold text-theme-primary hover:text-theme-secondary transition-colors cursor-pointer"
            >
              View all orders &rarr;
            </button>
          </div>

          <div className="divide-y divide-theme-border-subtle">
            {activeOrdersToDisplay.map((order) => {
              const currentStep = getTrackingStepIndex(order.status);
              const orderDate = order.createdAt
                ? new Date(order.createdAt).toLocaleDateString()
                : "";

              const isDelivered = order.status?.toLowerCase() === "delivered";
              const isReturned = order.status?.toLowerCase() === "returned";
              const isCancelled = order.status?.toLowerCase() === "cancelled";

              const finalStepLabel = isReturned
                ? "Returned"
                : isCancelled
                ? "Cancelled"
                : "Delivered";

              const finalStepRole = isReturned
                ? "Store"
                : isCancelled
                ? "Order"
                : "Staff";

              const finalStepTime = isDelivered
                ? "Delivered"
                : isReturned
                ? "Returned"
                : isCancelled
                ? "Cancelled"
                : "Expected soon";

              const trackingSteps = [
                {
                  label: "Placed",
                  role: "Admin",
                  time: orderDate || "Received",
                },
                {
                  label: "Packed",
                  role: "Admin",
                  time:
                    currentStep >= 1
                      ? order.status === "packed"
                        ? "Ready for Staff"
                        : "Processing"
                      : "Pending",
                },
                {
                  label: "Out for delivery",
                  role: "Staff",
                  time:
                    currentStep >= 2
                      ? order.status === "out_for_delivery"
                        ? "Staff on Route"
                        : "Dispatched"
                      : "Pending",
                },
                {
                  label: finalStepLabel,
                  role: finalStepRole,
                  time: finalStepTime,
                  isCancel: isCancelled,
                  isReturn: isReturned,
                },
              ];

              return (
                <div key={order.id} className="p-5 sm:p-6 space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-base text-theme-text-primary">
                        Order {order.orderNumber || `#${order.id}`}
                      </div>
                      <div className="text-xs text-theme-text-muted mt-1">
                        Placed on {orderDate} · {order.items?.length || 1} items · {formatPrice(order.totalAmount)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full ${getStatusBadgeClasses(
                          order.status
                        )}`}
                      >
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* 4-Breakpoint Stepper (Placed -> Packed -> Out for delivery -> Delivered/Returned/Cancelled) */}
                  <div className="grid grid-cols-4 gap-0 items-start pt-2">
                    {trackingSteps.map((step, idx) => {
                      const isDone = idx <= currentStep;
                      const isActive = idx === currentStep;
                      const isLast = idx === trackingSteps.length - 1;

                      const dotBg =
                        isLast && step.isCancel
                          ? "bg-red-500"
                          : isLast && step.isReturn
                          ? "bg-purple-600"
                          : isDone
                          ? "bg-theme-status-del-fg"
                          : isActive
                          ? "bg-theme-secondary"
                          : "bg-theme-border";

                      return (
                        <div key={step.label} className="flex flex-col gap-1.5 sm:gap-2 min-w-0">
                          <div className="flex items-center">
                            <span
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex-shrink-0 transition-colors ${dotBg}`}
                            />
                            {!isLast && (
                              <span
                                className={`h-0.5 flex-1 transition-colors ${
                                  idx < currentStep ? "bg-theme-status-del-fg" : "bg-theme-border"
                                }`}
                              />
                            )}
                          </div>

                          <div
                            className={`text-[11px] sm:text-xs font-semibold leading-tight pr-1 truncate ${
                              isDone || isActive ? "text-theme-text-primary" : "text-theme-text-muted"
                            }`}
                            title={step.label}
                          >
                            {step.label}
                          </div>
                          {step.time && (
                            <div className="text-[9px] sm:text-[10px] text-theme-text-muted pr-1 truncate">
                              {step.time}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Buy Again (Conditional: only shown if customer previously ordered items) */}
      {buyAgainItems.length > 0 && (
        <div className="bg-theme-surface border border-theme-border rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-theme-border-subtle bg-theme-surface-alt">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-theme-text-secondary">
              Buy Again
            </h3>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {buyAgainItems.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="border border-theme-border-subtle rounded-xl overflow-hidden bg-theme-surface-warm flex flex-col justify-between"
              >
                <div className="h-28 bg-[repeating-linear-gradient(45deg,#F6ECDC,#F6ECDC_8px,#EFE2CD_8px,#EFE2CD_16px)] flex items-center justify-center">
                  <span className="text-[10px] font-mono text-theme-text-muted uppercase tracking-wider">
                    {item.name.slice(0, 14)}
                  </span>
                </div>

                <div className="p-3.5 flex flex-col justify-between flex-1 gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase text-theme-text-primary line-clamp-2 min-h-[32px]">
                      {item.name}
                    </div>
                    <div className="text-sm font-semibold text-theme-primary mt-1.5">
                      {formatPrice(item.price)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1">
                    <button
                      type="button"
                      disabled={addingVariantId === item.variantId}
                      onClick={() => handleBuyAgain(item)}
                      className={`w-full text-xs font-semibold uppercase tracking-wider py-2.5 rounded-md transition-colors cursor-pointer min-h-[40px] ${
                        addedVariantId === item.variantId
                          ? "bg-green-600 text-white"
                          : "bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg"
                      } disabled:opacity-50`}
                    >
                      {addingVariantId === item.variantId ? (
                        "Adding..."
                      ) : addedVariantId === item.variantId ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Added to Cart
                        </span>
                      ) : (
                        "Reorder"
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigateTab("orders")}
                      className="text-[11px] font-medium text-theme-text-muted hover:text-theme-primary text-center py-1 transition-colors cursor-pointer"
                    >
                      View in Orders
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
