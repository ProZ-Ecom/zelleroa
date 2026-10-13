"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminOrdersCount } from "@/features/orders/hooks";
import type { AdminOrdersCountResponse } from "@/features/orders/types";

interface StatusTab {
  label: string;
  href: string;
  countKey?: keyof AdminOrdersCountResponse;
}

// Main fulfilment pipeline — always visible
const PRIMARY_TABS: StatusTab[] = [
  { label: "All", href: "/admin/dashboard/orders", countKey: "total" },
  { label: "Pending", href: "/admin/dashboard/orders/pending", countKey: "pending" },
  { label: "Confirmed", href: "/admin/dashboard/orders/confirmed", countKey: "confirmed" },
  { label: "Processing", href: "/admin/dashboard/orders/processing", countKey: "processing" },
  { label: "Packed", href: "/admin/dashboard/orders/packed", countKey: "packed" },
  { label: "Shipped", href: "/admin/dashboard/orders/shipped", countKey: "shipped" },
  { label: "Out for Delivery", href: "/admin/dashboard/orders/out-for-delivery", countKey: "out_for_delivery" },
  { label: "Delivered", href: "/admin/dashboard/orders/delivered", countKey: "delivered" },
];

// Exceptions & after-sales — tucked into a menu
const MORE_TABS: StatusTab[] = [
  { label: "Cancelled", href: "/admin/dashboard/orders/cancelled", countKey: "cancelled" },
  { label: "Returned", href: "/admin/dashboard/orders/returned", countKey: "returned" },
  { label: "Return Requests", href: "/admin/dashboard/orders/returns" },
  { label: "Replacement Requests", href: "/admin/dashboard/orders/replacements" },
];

function Badge({
  active,
  warn,
  children,
}: {
  active: boolean;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none tabular-nums",
        active
          ? "bg-white/20 text-white"
          : warn
          ? "bg-amber-100 text-amber-800"
          : "bg-neutral-100 text-neutral-600"
      )}
    >
      {children}
    </span>
  );
}

export function OrderStatusTabs() {
  const pathname = usePathname();
  const { data: counts, isLoading } = useAdminOrdersCount();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (tab: StatusTab) =>
    tab.href === "/admin/dashboard/orders"
      ? pathname === tab.href
      : pathname === tab.href || pathname.startsWith(tab.href + "/");

  const countOf = (tab: StatusTab) =>
    tab.countKey && counts ? counts[tab.countKey] : undefined;

  const activeMore = MORE_TABS.find(isActive);
  const moreTotal = MORE_TABS.reduce((sum, t) => sum + (countOf(t) ?? 0), 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-cream-border-subtle bg-white p-1 shadow-xs">
        {PRIMARY_TABS.map((tab) => {
          const active = isActive(tab);
          const count = countOf(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-secondary-600 text-cream-white shadow-xs"
                  : "text-neutral-600 hover:bg-cream-200 hover:text-secondary-800"
              )}
            >
              <span>{tab.label}</span>
              <Badge active={active} warn={tab.countKey === "pending" && !!count}>
                {isLoading ? "…" : count ?? 0}
              </Badge>
            </Link>
          );
        })}
      </div>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-2xl border px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors",
            activeMore
              ? "border-secondary-600 bg-secondary-600 text-cream-white"
              : "border-cream-border-subtle bg-white text-neutral-600 hover:bg-cream-200 hover:text-secondary-800"
          )}
        >
          <span>{activeMore ? activeMore.label : "More"}</span>
          {!activeMore && moreTotal > 0 && <Badge active={false}>{moreTotal}</Badge>}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-cream-border-subtle bg-white p-1 shadow-lg"
          >
            {MORE_TABS.map((tab, i) => {
              const active = isActive(tab);
              const count = countOf(tab);
              return (
                <div key={tab.href}>
                  {i === 2 && <div className="my-1 h-px bg-cream-border-subtle" />}
                  <Link
                    role="menuitem"
                    href={tab.href}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                      active
                        ? "bg-secondary-600 text-cream-white"
                        : "text-neutral-700 hover:bg-cream-200 hover:text-secondary-800"
                    )}
                  >
                    <span>{tab.label}</span>
                    {tab.countKey && <Badge active={active}>{isLoading ? "…" : count ?? 0}</Badge>}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
