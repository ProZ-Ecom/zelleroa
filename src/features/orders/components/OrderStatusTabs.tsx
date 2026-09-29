"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAdminOrdersCount } from "@/features/orders/hooks";
import type { AdminOrdersCountResponse } from "@/features/orders/types";

interface StatusTab {
  label: string;
  href: string;
  countKey?: keyof AdminOrdersCountResponse;
}

const TABS: StatusTab[] = [
  { label: "All", href: "/admin/dashboard/orders", countKey: "total" },
  { label: "Pending", href: "/admin/dashboard/orders/pending", countKey: "pending" },
  { label: "Confirmed", href: "/admin/dashboard/orders/confirmed", countKey: "confirmed" },
  { label: "Processing", href: "/admin/dashboard/orders/processing", countKey: "processing" },
  { label: "Packed", href: "/admin/dashboard/orders/packed", countKey: "packed" },
  { label: "Shipped", href: "/admin/dashboard/orders/shipped", countKey: "shipped" },
  { label: "Out for Delivery", href: "/admin/dashboard/orders/out-for-delivery", countKey: "out_for_delivery" },
  { label: "Delivered", href: "/admin/dashboard/orders/delivered", countKey: "delivered" },
  { label: "Cancelled", href: "/admin/dashboard/orders/cancelled", countKey: "cancelled" },
  { label: "Returned", href: "/admin/dashboard/orders/returned", countKey: "returned" },
  { label: "Return Requests", href: "/admin/dashboard/orders/returns" },
  { label: "Replacement Requests", href: "/admin/dashboard/orders/replacements" },
];

export function OrderStatusTabs() {
  const pathname = usePathname();
  const { data: counts, isLoading } = useAdminOrdersCount();

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/admin/dashboard/orders"
            ? pathname === "/admin/dashboard/orders"
            : pathname === tab.href || pathname.startsWith(tab.href + "/");

        const count = tab.countKey && counts ? counts[tab.countKey] : undefined;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border",
              isActive
                ? "bg-secondary-600 text-cream-white border-secondary-600 shadow-xs"
                : "bg-white text-neutral-600 border-cream-border-subtle hover:bg-cream-200 hover:text-secondary-800 hover:border-cream-border-hover"
            )}
          >
            <span>{tab.label}</span>
            {tab.countKey && <span
              className={cn(
                "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none",
                isActive
                  ? "bg-white/20 text-white"
                  : count && count > 0
                  ? tab.countKey === "pending"
                    ? "bg-amber-100 text-amber-800 font-bold"
                    : "bg-neutral-100 text-neutral-700"
                  : "bg-neutral-100 text-neutral-400"
              )}
            >
              {isLoading ? "…" : count ?? 0}
            </span>}
          </Link>
        );
      })}
    </div>
  );
}
