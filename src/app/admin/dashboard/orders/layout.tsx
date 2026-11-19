"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Globe, Store } from "lucide-react";
import {
  AdminPageHeader,
  AdminContent,
} from "@/components/admin/AdminPageHeader";
import { OrderStatsCards } from "@/features/orders/components/OrderStatsCards";
import { OrderStatusTabs } from "@/features/orders/components/OrderStatusTabs";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { AdminVideoStorageAlert } from "@/features/returns/components/AdminVideoStorageAlert";
import { useAdminOrdersCount } from "@/features/orders/hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isStaff = (session?.user as { role?: string })?.role === "STAFF";

  const { data: counts, isLoading: isCountsLoading } = useAdminOrdersCount();

  const isPosActive = pathname.startsWith("/admin/dashboard/orders/pos");
  const isOnlineActive = !isPosActive;

  useEffect(() => {
    if (status === "authenticated" && isStaff) {
      router.replace("/admin/dashboard/delivery");
    }
  }, [status, isStaff, router]);

  if (status === "loading" || (status === "authenticated" && isStaff)) {
    return <AdminTableSkeleton showStats />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminPageHeader
        title="Orders"
        description="View, manage and fulfill customer and counter orders"
      />

      {/* Channel Switcher: Online Orders vs POS Sales */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-cream-border-subtle pb-3">
        <div className="flex items-center gap-1 rounded-2xl border border-cream-border-subtle bg-white p-1 shadow-xs">
          <Link
            href="/admin/dashboard/orders"
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors",
              isOnlineActive
                ? "bg-secondary-600 text-white shadow-xs"
                : "text-neutral-600 hover:bg-cream-200 hover:text-secondary-800"
            )}
          >
            <Globe className="h-4 w-4" />
            <span>Online Orders</span>
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold leading-none tabular-nums",
                isOnlineActive
                  ? "bg-white/20 text-white"
                  : "bg-neutral-100 text-neutral-600"
              )}
            >
              {isCountsLoading ? "…" : counts?.channelCounts?.online ?? 0}
            </span>
          </Link>

          <Link
            href="/admin/dashboard/orders/pos"
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors",
              isPosActive
                ? "bg-secondary-600 text-white shadow-xs"
                : "text-neutral-600 hover:bg-cream-200 hover:text-secondary-800"
            )}
          >
            <Store className="h-4 w-4" />
            <span>POS Sales</span>
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold leading-none tabular-nums",
                isPosActive
                  ? "bg-white/20 text-white"
                  : "bg-neutral-100 text-neutral-600"
              )}
            >
              {isCountsLoading ? "…" : counts?.channelCounts?.pos ?? 0}
            </span>
          </Link>
        </div>

        {isPosActive && (
          <Link href="/admin/dashboard/pos">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Store className="h-3.5 w-3.5" />
              Open POS Register
            </Button>
          </Link>
        )}
      </div>

      {/* Online orders view has fulfillment metrics and pipeline status tabs */}
      {isOnlineActive && (
        <div className="mt-3 flex flex-col gap-3">
          <AdminVideoStorageAlert />
          {/* Order Statistics for Online Orders */}
          <OrderStatsCards />

          {/* Status Tabs Navigation for Online Orders */}
          <div className="mt-1">
            <OrderStatusTabs />
          </div>
        </div>
      )}

      <AdminContent className="mt-3 flex-1 min-h-0">
        {children}
      </AdminContent>
    </div>
  );
}
