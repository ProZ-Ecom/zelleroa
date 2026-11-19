"use client";

import * as React from "react";
import {
  Mail,
  Phone,
} from "lucide-react";
import type {
  AdminCustomerListItemDto,
  AdminCustomerDetailDto,
} from "../../types/admin-customer.types";
import { formatPhone } from "@/lib/utils/format-phone";
interface CustomerInfoCardProps {
  customer: AdminCustomerListItemDto | AdminCustomerDetailDto;
}

export function CustomerInfoCard({ customer }: CustomerInfoCardProps) {
  return (
    <div className="rounded-2xl border border-cream-border bg-white p-4 sm:p-6 md:p-7 shadow-xs h-full flex flex-col justify-center">
      <div className="space-y-4 my-auto w-full">
        {/* Header matching screenshot monospace tracked style */}
        <div className="border-b border-cream-border pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
            Contact Information
          </h3>
        </div>

        {/* Primary Contact Rows */}
        <div className="space-y-3.5">
          {/* Email Row */}
          <div className="flex items-start gap-3.5">
            <Mail className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs text-neutral-400 font-medium font-mono">Email</p>
              <p className="text-sm font-medium text-neutral-800 break-all leading-snug">
                {customer.email || "—"}
              </p>
            </div>
          </div>

          {/* Phone Row */}
          <div className="flex items-start gap-3.5">
            <Phone className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-neutral-400 font-medium font-mono">Phone</p>
                {customer.isWhatsapp && (
                  <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.2 rounded">
                    WA
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-neutral-800 leading-snug">
                {formatPhone(customer.phone)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
