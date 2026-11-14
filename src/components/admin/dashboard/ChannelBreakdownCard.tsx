"use client";

import Link from "next/link";
import {
  Globe,
  Store,
  Banknote,
  ArrowRight,
  Clock,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { ChannelBreakdown } from "@/features/dashboard/api/get-stats";
import { Button } from "@/components/ui/button";

interface ChannelBreakdownCardProps {
  breakdown?: ChannelBreakdown;
}

export function ChannelBreakdownCard({ breakdown }: ChannelBreakdownCardProps) {
  const online = breakdown?.online ?? {
    totalOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    pendingOrders: 0,
  };

  const pos = breakdown?.pos ?? {
    totalOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    cashSales: 0,
    upiSales: 0,
    cardSales: 0,
  };

  const totalRevenue = online.totalRevenue + pos.totalRevenue;
  const onlineShare = totalRevenue > 0 ? Math.round((online.totalRevenue / totalRevenue) * 100) : 50;
  const posShare = totalRevenue > 0 ? 100 - onlineShare : 50;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Online Store Channel Card */}
        <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Online Store</h3>
                <p className="text-[11px] text-neutral-500">E-commerce & website orders</p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 border border-sky-200">
              {onlineShare}% of revenue
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wider">
                Total Revenue
              </p>
              <p className="mt-1 text-lg font-bold text-neutral-900 tabular-nums">
                {formatPrice(online.totalRevenue)}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Today: {formatPrice(online.todayRevenue)}
              </p>
            </div>

            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wider">
                Total Orders
              </p>
              <p className="mt-1 text-lg font-bold text-neutral-900 tabular-nums">
                {online.totalOrders.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Today: {online.todayOrders.toLocaleString("en-IN")} orders
              </p>
            </div>

            <div className="rounded-xl bg-neutral-50 p-3 col-span-2 sm:col-span-1">
              <p className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wider">
                Fulfillment
              </p>
              <p className="mt-1 text-lg font-bold text-amber-700 tabular-nums flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-600" />
                {online.pendingOrders}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {online.pendingOrders > 0 ? "Awaiting packing" : "All fulfilled"}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
            <Link
              href="/admin/dashboard/orders"
              className="text-xs font-semibold text-secondary-600 hover:text-secondary-800 inline-flex items-center gap-1"
            >
              Manage Online Orders <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* POS Counter Channel Card */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Counter POS</h3>
                <p className="text-[11px] text-neutral-500">Retail counter & walk-in billing</p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
              {posShare}% of revenue
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wider">
                Gross Counter Sales
              </p>
              <p className="mt-1 text-lg font-bold text-neutral-900 tabular-nums">
                {formatPrice(pos.totalRevenue)}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Today: {formatPrice(pos.todayRevenue)}
              </p>
            </div>

            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wider">
                Counter Bills
              </p>
              <p className="mt-1 text-lg font-bold text-neutral-900 tabular-nums">
                {pos.totalOrders.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Today: {pos.todayOrders.toLocaleString("en-IN")} bills
              </p>
            </div>

            <div className="rounded-xl bg-neutral-50 p-3 col-span-2 sm:col-span-1">
              <p className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wider">
                Cash in Drawer
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-700 tabular-nums flex items-center gap-1.5">
                <Banknote className="h-4 w-4 text-emerald-600" />
                {formatPrice(pos.cashSales)}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                UPI: {formatPrice(pos.upiSales)} · Card: {formatPrice(pos.cardSales)}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
            <Link
              href="/admin/dashboard/orders/pos"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              View POS Sales & Receipts <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/admin/dashboard/pos">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-neutral-200">
                <Store className="h-3 w-3" /> Billing Register
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

