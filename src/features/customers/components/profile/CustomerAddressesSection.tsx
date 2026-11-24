"use client";

import * as React from "react";
import { MapPin, Phone, User, Home, Building } from "lucide-react";
import type { AdminCustomerAddressDto } from "../../types/admin-customer.types";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { formatPhone } from "@/lib/utils/format-phone";

interface CustomerAddressesSectionProps {
  addresses?: AdminCustomerAddressDto[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function CustomerAddressesSection({
  addresses = [],
  isLoading = false,
  error = null,
  onRetry,
}: CustomerAddressesSectionProps) {
  if (isLoading) {
    return <LoadingState text="Loading customer addresses..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message || "Failed to load customer addresses"}
        onRetry={onRetry}
      />
    );
  }

  if (!addresses || addresses.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          <MapPin className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-neutral-900">
          No Saved Addresses
        </h3>
        <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
          This customer has not added any delivery addresses to their account yet.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {addresses.map((addr) => {
          const label =
            (addr as unknown as { label?: string }).label ||
            addr.type ||
            "Delivery Address";
          const isHome = label.toLowerCase().includes("home");
          const isWork =
            label.toLowerCase().includes("work") ||
            label.toLowerCase().includes("office");

          return (
            <div
              key={addr.id}
              className="rounded-xl border border-cream-border p-4 sm:p-5 bg-white shadow-xs transition-all relative flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header: Label & Badges */}
                <div className="flex items-center justify-between gap-2 border-b border-cream-border-subtle pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-cream-100 text-neutral-600">
                      {isWork ? (
                        <Building className="h-3.5 w-3.5" />
                      ) : isHome ? (
                        <Home className="h-3.5 w-3.5" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-800 font-mono">
                      {label}
                    </span>
                  </div>

                  {addr.isDefault && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-success-50 text-success-700">
                      Default
                    </span>
                  )}
                </div>

                {/* Recipient Details */}
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-neutral-900 font-semibold">
                    <User className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span>{addr.fullName}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <Phone className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span>{formatPhone(addr.phone)}</span>
                  </div>
                </div>

                {/* Street & Location Details */}
                <div className="text-xs text-neutral-600 space-y-0.5 leading-relaxed bg-cream-50 p-3 rounded-lg border border-cream-border">
                  <p className="font-medium text-neutral-800">
                    {addr.addressLine1}
                  </p>
                  {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                  {addr.landmark && (
                    <p className="text-neutral-500 italic">
                      Landmark: {addr.landmark}
                    </p>
                  )}
                  <p className="font-medium text-neutral-800 pt-0.5">
                    {addr.city}, {addr.state} –{" "}
                    <span className="font-mono font-bold text-neutral-900">
                      {addr.pincode}
                    </span>
                  </p>
                  <p className="text-neutral-500">{addr.country}</p>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-cream-border-subtle flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                <span>ID: {addr.id.slice(0, 8)}...</span>
                <span>
                  Added: {new Date(addr.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
