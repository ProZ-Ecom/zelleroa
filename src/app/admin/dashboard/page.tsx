"use client";

import { useState } from "react";
import Link from "next/link";
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
  Layers,
  Globe,
  Store,
} from "lucide-react";
import { MetricCard, type Tone } from "@/components/admin/dashboard/MetricCard";
import { DashboardSkeleton } from "@/components/admin/dashboard/DashboardSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useDashboardStats } from "@/features/dashboard/hooks";
import type {
  DashboardMetrics,
  DashboardRange,
  DashboardChannel,
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
import { ChannelBreakdownCard } from "@/components/admin/dashboard/ChannelBreakdownCard";

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const CHANNELS: {
  value: DashboardChannel;
  label: string;
  icon: typeof Layers;
}[] = [
  { value: "all", label: "All Channels", icon: Layers },
  { value: "online", label: "Online Store", icon: Globe },
  { value: "pos", label: "POS Counter", icon: Store },
];

const CARDS: {
  key: keyof DashboardMetrics;
  totalTitle: string;
  onlineTitle?: string;
  posTitle?: string;
  todayLabel: string;
  icon: typeof Users;
  tone: Tone;
  money?: boolean;
  /** An increase is a bad thing. */
  invert?: boolean;
}[] = [
  { key: "users", totalTitle: "Total Users", todayLabel: "new today", icon: Users, tone: "primary" },
  { key: "agents", totalTitle: "Total Agents", todayLabel: "new today", icon: UserCheck, tone: "primary" },
  { key: "orders", totalTitle: "Total Orders", onlineTitle: "Online Orders", posTitle: "POS Counter Bills", todayLabel: "today", icon: ShoppingCart, tone: "primary" },
  { key: "sales", totalTitle: "Total Sales", onlineTitle: "Online Sales", posTitle: "POS Counter Sales", todayLabel: "today", icon: BadgeIndianRupee, tone: "success", money: true },
  { key: "revenue", totalTitle: "Total Revenue", onlineTitle: "Online Revenue", posTitle: "POS Revenue", todayLabel: "today", icon: Wallet, tone: "success", money: true },
  { key: "cancelled", totalTitle: "Cancelled Orders", onlineTitle: "Cancelled Online Orders", posTitle: "Voided Bills", todayLabel: "today", icon: XCircle, tone: "danger", invert: true },
  { key: "returned", totalTitle: "Returned Orders", onlineTitle: "Online Returns", posTitle: "Returned POS Items", todayLabel: "today", icon: Undo2, tone: "warning", invert: true },
  { key: "pending", totalTitle: "Pending Orders", onlineTitle: "Pending Fulfillment", posTitle: "Pending Bills", todayLabel: "today", icon: Clock, tone: "warning", invert: true },
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
  const [channel, setChannel] = useState<DashboardChannel>("all");
  const { data: stats, isLoading, error, refetch } = useDashboardStats(range, channel);

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

  const heroSubtitle =
    channel === "online"
      ? "Here is a snapshot of your Online Store orders, web customers, and delivery pipeline."
      : channel === "pos"
      ? "Here is a snapshot of your in-store POS counter billing, tender collections, and walk-in sales."
      : "Unified snapshot of your store's online e-commerce and in-person POS performance.";

  const heroStats = [
    {
      label:
        channel === "pos"
          ? "POS revenue today"
          : channel === "online"
          ? "Online revenue today"
          : "Revenue today",
      value: formatPrice(stats.today.revenue),
    },
    {
      label:
        channel === "pos"
          ? "POS bills today"
          : channel === "online"
          ? "Online orders today"
          : "Orders today",
      value: stats.today.orders.toLocaleString("en-IN"),
    },
    {
      label:
        channel === "pos"
          ? "Total POS revenue"
          : channel === "online"
          ? "Pending fulfillment"
          : "Pending now",
      value:
        channel === "pos"
          ? formatPrice(stats.overall.revenue)
          : stats.overall.pending.toLocaleString("en-IN"),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        breadcrumbs={<AdminBreadcrumb items={[{ label: "Dashboard" }]} />}
      />

      <AdminContent>
        <div className="space-y-8">
          {/* Channel Selector Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-2.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-neutral-100/90 p-1">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                const isActive = channel === c.value;
                const count =
                  c.value === "online"
                    ? stats.channelBreakdown?.online.totalOrders
                    : c.value === "pos"
                    ? stats.channelBreakdown?.pos.totalOrders
                    : (stats.channelBreakdown?.online.totalOrders ?? 0) +
                      (stats.channelBreakdown?.pos.totalOrders ?? 0);

                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannel(c.value)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                      isActive
                        ? "bg-white text-neutral-900 shadow-xs ring-1 ring-black/5"
                        : "text-neutral-600 hover:bg-white/60 hover:text-neutral-900"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        isActive
                          ? c.value === "pos"
                            ? "text-emerald-600"
                            : c.value === "online"
                            ? "text-sky-600"
                            : "text-[var(--color-primary-600)]"
                          : "text-neutral-400"
                      )}
                    />
                    <span>{c.label}</span>
                    {count !== undefined && count > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                          isActive
                            ? c.value === "pos"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.value === "online"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-[var(--color-primary-100)] text-[var(--color-primary-800)]"
                            : "bg-neutral-200/80 text-neutral-600"
                        )}
                      >
                        {count.toLocaleString("en-IN")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/dashboard/orders"
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
              >
                <Globe className="h-3.5 w-3.5" />
                Online Orders
              </Link>
              <Link
                href="/admin/dashboard/orders/pos"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <Store className="h-3.5 w-3.5" />
                POS Sales
              </Link>
            </div>
          </div>

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
                <p className="mt-1 text-sm text-white/75">{heroSubtitle}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {heroStats.map((k) => (
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

          {/* Sales Channels Breakdown: Online vs POS */}
          {stats.channelBreakdown && (
            <section>
              <SectionHeading
                title="Sales Channels Breakdown"
                subtitle="Side-by-side comparison of Online Store and Counter POS performance"
              />
              <ChannelBreakdownCard breakdown={stats.channelBreakdown} />
            </section>
          )}

          {/* Store Overview */}
          <section>
            <SectionHeading
              title={
                channel === "online"
                  ? "Online Store Overview"
                  : channel === "pos"
                  ? "POS Counter Overview"
                  : "Store Overview"
              }
              subtitle={
                channel === "online"
                  ? "All-time online store metrics, with today's count and change vs yesterday"
                  : channel === "pos"
                  ? "All-time counter POS metrics, with today's count and change vs yesterday"
                  : "All-time combined totals, with today's count and change vs yesterday"
              }
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CARDS.map((c) => {
                const title =
                  channel === "pos"
                    ? c.posTitle || c.totalTitle
                    : channel === "online"
                    ? c.onlineTitle || c.totalTitle
                    : c.totalTitle;
                return (
                  <MetricCard
                    key={c.key}
                    title={title}
                    value={fmt(stats.overall[c.key], c.money)}
                    icon={c.icon}
                    tone={c.tone}
                    today={fmt(stats.today[c.key], c.money)}
                    todayLabel={c.todayLabel}
                    invertChange={c.invert}
                    change={stats.todayVsYesterday[c.key]}
                  />
                );
              })}
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

          {/* Agent performance section: commented/hidden in POS counter tab because customers come directly to the store and are not linked with sales agents */}
          {channel !== "pos" && (
            <section>
              <AgentsOverview agents={stats.agents} periodLabel={rangeLabel} />
            </section>
          )}

          <section>
            <SectionHeading
              title={
                channel === "online"
                  ? "Recent Online Orders"
                  : channel === "pos"
                  ? "Recent POS Counter Sales"
                  : "Recent Orders"
              }
              subtitle="Latest activity"
            />
            <RecentOrders orders={stats.recentOrders} channel={channel} />
          </section>
        </div>
      </AdminContent>
    </div>
  );
}
