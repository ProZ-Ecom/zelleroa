"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Users,
  UserCheck,
  ShoppingCart,
  BadgeIndianRupee,
  Wallet,
  XCircle,
  Undo2,
  Clock,
} from "lucide-react";
import { MetricCard, type Tone } from "@/components/admin/dashboard/MetricCard";
import { DashboardSkeleton } from "@/components/admin/dashboard/DashboardSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useDashboardStats } from "@/features/dashboard/hooks";
import type {
  DashboardMetrics,
  DashboardRange,
} from "@/features/dashboard/api/get-stats";
import { formatPrice, cn } from "@/lib/utils";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { SalesChart } from "@/components/admin/dashboard/SalesChart";
import { RecentOrders } from "@/components/admin/dashboard/RecentOrders";
import { TopProducts } from "@/components/admin/dashboard/TopProducts";
import { LowStockAlerts } from "@/components/admin/dashboard/LowStockAlerts";
import { OrderStatusBreakdown } from "@/components/admin/dashboard/OrderStatusBreakdown";
import { AgentsOverview } from "@/components/admin/dashboard/AgentsOverview";
import { TopCustomers } from "@/components/admin/dashboard/TopCustomers";

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const CARDS: {
  key: keyof DashboardMetrics;
  totalTitle: string;
  todayLabel: string;
  icon: typeof Users;
  tone: Tone;
  money?: boolean;
  /** An increase is a bad thing. */
  invert?: boolean;
}[] = [
  { key: "users", totalTitle: "Total Users", todayLabel: "new today", icon: Users, tone: "primary" },
  { key: "agents", totalTitle: "Total Agents", todayLabel: "new today", icon: UserCheck, tone: "primary" },
  { key: "orders", totalTitle: "Total Orders", todayLabel: "today", icon: ShoppingCart, tone: "primary" },
  { key: "sales", totalTitle: "Total Sales", todayLabel: "today", icon: BadgeIndianRupee, tone: "success", money: true },
  { key: "revenue", totalTitle: "Total Revenue", todayLabel: "today", icon: Wallet, tone: "success", money: true },
  { key: "cancelled", totalTitle: "Cancelled Orders", todayLabel: "today", icon: XCircle, tone: "danger", invert: true },
  { key: "returned", totalTitle: "Returned Orders", todayLabel: "today", icon: Undo2, tone: "warning", invert: true },
  { key: "pending", totalTitle: "Pending Orders", todayLabel: "today", icon: Clock, tone: "warning", invert: true },
];

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        aria-hidden
        className="h-6 w-1 rounded-full"
        style={{ backgroundImage: "linear-gradient(var(--primary-500), var(--primary-700))" }}
      />
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--color-neutral-900)]">
          {title}
        </h2>
        <p className="text-sm text-[var(--color-neutral-500)]">{subtitle}</p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [range, setRange] = useState<DashboardRange>(7);
  const { data: stats, isLoading, error, refetch } = useDashboardStats(range);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !stats) {
    return (
      <ErrorState
        message="Failed to load dashboard stats. Please try again."
        onRetry={refetch}
      />
    );
  }

  const rangeLabel = `Last ${range} days`;
  const fmt = (v: number, money?: boolean) => (money ? formatPrice(v) : v.toLocaleString("en-IN"));
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        breadcrumbs={<AdminBreadcrumb items={[{ label: "Dashboard" }]} />}
      />

      <AdminContent>
        <div className="space-y-8">
          {/* Hero */}
          <section
            className="relative overflow-hidden rounded-3xl p-6 text-white shadow-[0_20px_40px_-20px_rgba(29,78,216,0.55)] sm:p-8"
            style={{
              backgroundImage:
                "linear-gradient(120deg, var(--primary-800) 0%, var(--primary-600) 55%, var(--primary-500) 100%)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-white/10 blur-3xl"
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-medium text-white/70">{todayLabel}</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  Welcome back, {session?.user?.name || "Admin"}
                </h2>
                <p className="mt-1 text-sm text-white/75">
                  Here&apos;s a snapshot of how your store is doing today.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[
                  { label: "Revenue today", value: formatPrice(stats.today.revenue) },
                  { label: "Orders today", value: stats.today.orders.toLocaleString("en-IN") },
                  { label: "Pending now", value: stats.overall.pending.toLocaleString("en-IN") },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm"
                  >
                    <p className="text-[11px] font-medium tracking-wide text-white/70 uppercase">
                      {k.label}
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums sm:text-xl">{k.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
          {/* Overall */}
          <section>
            <SectionHeading title="Store Overview" subtitle="All-time totals, with today's count and change vs yesterday" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CARDS.map((c) => (
                <MetricCard
                  key={c.key}
                  title={c.totalTitle}
                  value={fmt(stats.overall[c.key], c.money)}
                  icon={c.icon}
                  tone={c.tone}
                  today={fmt(stats.today[c.key], c.money)}
                  todayLabel={c.todayLabel}
                  invertChange={c.invert}
                  change={stats.todayVsYesterday[c.key]}
                />
              ))}
            </div>
          </section>

          {/* Trends */}
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SectionHeading title="Trends" subtitle={rangeLabel} />
              <div className="inline-flex rounded-xl bg-[var(--color-neutral-100)] p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRange(r.value)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      range === r.value
                        ? "bg-white text-[var(--color-primary-700)] shadow-sm"
                        : "text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-900)]"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SalesChart data={stats.salesTrend} rangeLabel={rangeLabel} />
              </div>
              <OrderStatusBreakdown statuses={stats.ordersByStatus} periodLabel={rangeLabel} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              <TopProducts products={stats.topProducts} />
              <TopCustomers customers={stats.topCustomers} />
              <div className="lg:col-span-2 2xl:col-span-1">
                <LowStockAlerts items={stats.lowStockItems} />
              </div>
            </div>
          </section>

          <section>
            <AgentsOverview agents={stats.agents} periodLabel={rangeLabel} />
          </section>

          <section>
            <SectionHeading title="Recent Orders" subtitle="Latest activity" />
            <RecentOrders orders={stats.recentOrders} />
          </section>
        </div>
      </AdminContent>
    </div>
  );
}
