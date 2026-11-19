"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  CustomerProfileHeader,
  CustomerTopBar,
  CustomerInfoCard,
  CustomerAddressesSection,
  CustomerOrdersSection,
  CustomerCartSection,
  CustomerWishlistSection,
  CustomerActivityCard,
} from "@/features/customers/components";
import {
  useAdminCustomerDetail,
  useAdminCustomerAddresses,
  useAdminCustomerOrders,
  useAdminCustomerWishlist,
  useAdminCustomerCart,
} from "@/features/customers/hooks";
import { AdminDetailSkeleton } from "@/components/admin/AdminDetailSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { CustomerAgentCard } from "@/features/agents/components/admin/CustomerAgentCard";

type ProfileTab = "orders" | "addresses" | "wishlist" | "cart";

export default function AdminCustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const customerId = params?.id ? decodeURIComponent(params.id) : "";

  // 1. Customer Profile Query
  const {
    data: customer,
    isLoading: isLoadingProfile,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useAdminCustomerDetail(customerId);

  // Extract canonical customer identifier strictly from Profile API response
  const profileId = customer?.id;

  // 2. Customer Addresses Query (strictly depends on profileId)
  const {
    data: addresses,
    isLoading: isLoadingAddresses,
    error: addressesError,
    refetch: refetchAddresses,
  } = useAdminCustomerAddresses(profileId);

  // 3. Customer Orders Query (strictly depends on profileId)
  const [orderPage, setOrderPage] = React.useState(1);
  const {
    data: ordersResponse,
    isLoading: isLoadingOrders,
    error: ordersError,
    refetch: refetchOrders,
  } = useAdminCustomerOrders(profileId, {
    page: orderPage,
    pageSize: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  // 4. Customer Wishlist Query (strictly depends on profileId)
  const {
    data: wishlistResponse,
    isLoading: isLoadingWishlist,
    error: wishlistError,
    refetch: refetchWishlist,
  } = useAdminCustomerWishlist(profileId);

  // 5. Customer Cart Query (strictly depends on profileId)
  const {
    data: cartResponse,
    isLoading: isLoadingCart,
    error: cartError,
    refetch: refetchCart,
  } = useAdminCustomerCart(profileId);

  // Default active tab to "orders" matching screenshot
  const [activeTab, setActiveTab] = React.useState<ProfileTab>("orders");

  const orderCount =
    ordersResponse?.meta?.total ?? ordersResponse?.data?.length ?? 0;

  const totalSpent = React.useMemo(() => {
    return (ordersResponse?.data || []).reduce(
      (sum, order) => sum + (Number(order.totalAmount) || 0),
      0
    );
  }, [ordersResponse?.data]);

  const defaultAddress = React.useMemo(() => {
    return addresses?.find((a) => a.isDefault) || addresses?.[0];
  }, [addresses]);

  const locationString = defaultAddress
    ? `${defaultAddress.city}${defaultAddress.state ? `, ${defaultAddress.state}` : ""}`
    : "Seattle, WA";

  const tabs: Array<{
    id: ProfileTab;
    label: string;
  }> = [
    { id: "orders", label: "Orders" },
    { id: "addresses", label: "Addresses" },
    { id: "wishlist", label: "Wishlist" },
    { id: "cart", label: "Cart" },
  ];

  if (isLoadingProfile && !customer) {
    return <AdminDetailSkeleton />;
  }

  if (isProfileError || !customer) {
    return (
      <ErrorState
        message={
          profileError instanceof Error
            ? profileError.message
            : "Customer profile not found or failed to load."
        }
        onRetry={() => refetchProfile()}
      />
    );
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Top Header & Breadcrumb Actions */}
      <CustomerTopBar customer={customer} />

      {/* Top Row: Customer Profile Summary & Contact Information (2 Columns on lg, 1 column on md/sm) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Column: Customer Profile Card with Totals */}
        <div className="lg:col-span-7">
          <CustomerProfileHeader
            customer={customer}
            totalSpent={totalSpent}
            totalOrders={orderCount}
            location={locationString}
          />
        </div>

        {/* Right Column: Contact Information Card */}
        <div className="lg:col-span-5">
          <CustomerInfoCard customer={customer} />
        </div>
      </div>

      <CustomerAgentCard customerId={customer.id} />

      {/* Middle Section: Tabbed Container */}
      <div className="rounded-2xl border border-cream-border bg-white shadow-xs overflow-hidden">
        {/* Tab Navigation Header Bar with Horizontal Scroll */}
        <div className="bg-cream-100 border-b border-cream-border px-3 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-8 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 sm:py-3.5 px-1 font-mono text-xs sm:text-sm font-semibold tracking-wide transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "border-secondary-600 text-secondary-600"
                      : "border-transparent text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Tab Content */}
        <div>
          {activeTab === "orders" && (
            <CustomerOrdersSection
              orders={ordersResponse?.data}
              meta={ordersResponse?.meta}
              isLoading={isLoadingOrders}
              error={ordersError as Error | null}
              onRetry={refetchOrders}
              onPageChange={(page) => setOrderPage(page)}
            />
          )}

          {activeTab === "addresses" && (
            <CustomerAddressesSection
              addresses={addresses}
              isLoading={isLoadingAddresses}
              error={addressesError as Error | null}
              onRetry={refetchAddresses}
            />
          )}

          {activeTab === "wishlist" && (
            <CustomerWishlistSection
              wishlist={wishlistResponse?.items}
              isLoading={isLoadingWishlist}
              error={wishlistError as Error | null}
              onRetry={refetchWishlist}
            />
          )}

          {activeTab === "cart" && (
            <CustomerCartSection
              cart={cartResponse}
              isLoading={isLoadingCart}
              error={cartError as Error | null}
              onRetry={refetchCart}
            />
          )}
        </div>
      </div>

      {/* Bottom Section: Recent Activity Timeline Card */}
      {/* <CustomerActivityCard
        customer={customer}
        orders={ordersResponse?.data}
      /> */}
    </div>
  );
}
