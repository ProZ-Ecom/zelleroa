"use client";

import React, { useState, useMemo } from "react";
import {
  History,
  BarChart3,
  List,
  User,
  IndianRupee,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import {
  useVariantPriceHistory,
  useVariantPriceHistoryChart,
} from "../hooks";
import type { AdminVariantResponse, VariantPriceHistoryResponse } from "../types";

export interface VariantPriceHistoryCardProps {
  variant: AdminVariantResponse;
  gstPercent?: number;
}

type RangeOption = "30D" | "6M" | "1Y";

/**
 * Price + price-history are now tracked per (unit, price) combination rather
 * than per item, since one item can be sold in multiple pack sizes. When the
 * item has more than one unit price, a selector lets the admin switch which
 * pack size's history to view.
 */
export function VariantPriceHistoryCard({
  variant,
  gstPercent = 18,
}: VariantPriceHistoryCardProps) {
  const unitPrices = variant.unitPrices ?? [];
  const [selectedUnitPriceId, setSelectedUnitPriceId] = useState<string | null>(null);

  // Fall back to the default (or first) unit price whenever no explicit
  // selection has been made yet, without needing an effect + extra render.
  const selectedUnitPrice =
    unitPrices.find((up) => up.id === selectedUnitPriceId) ??
    unitPrices.find((up) => up.isDefault) ??
    unitPrices[0] ??
    null;

  const [activeTab, setActiveTab] = useState<"graph" | "list">("graph");
  const [range, setRange] = useState<RangeOption>("1Y");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const periodApiVal = useMemo(() => {
    if (range === "30D") return "1m";
    if (range === "6M") return "6m";
    return "1y";
  }, [range]);

  const { data: chartApiData = [] } = useVariantPriceHistoryChart(
    selectedUnitPrice?.id ?? null,
    periodApiVal
  );

  const { data: historyApiResponse, isLoading: isLoadingHistory } =
    useVariantPriceHistory(selectedUnitPrice?.id ?? null, {
      pageSize: 50,
      sortOrder: "desc",
    });

  const rawHistoryList: VariantPriceHistoryResponse[] = useMemo(() => {
    return (historyApiResponse?.data as VariantPriceHistoryResponse[]) ?? [];
  }, [historyApiResponse]);

  const basePrice = Number(selectedUnitPrice?.basePrice) || 0;
  const gstAmount = Math.round((basePrice * gstPercent) / (100 + gstPercent));
  const taxableValue = basePrice - gstAmount;

  const chartSeries = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (chartApiData && chartApiData.length > 0) {
      return chartApiData.map((item) => {
        const [yearStr, monthNumStr] = item.month.split("-");
        const monthIndex = parseInt(monthNumStr, 10) - 1;
        const monthLabel = months[monthIndex] || item.month;
        return {
          date: monthLabel,
          fullDate: `${monthLabel} ${yearStr}`,
          value: item.price,
        };
      });
    }

    return [
      { date: "Current", fullDate: "Latest updated price", value: basePrice },
    ];
  }, [chartApiData, basePrice]);

  const values = chartSeries.map((s) => s.value);
  const maxVal = Math.max(...values, basePrice, 1);
  const minVal = Math.min(...values, basePrice);
  const span = Math.max(1, maxVal - minVal);

  if (unitPrices.length === 0) {
    return (
      <div className="bg-white border border-cream-border rounded-2xl overflow-hidden shadow-xs p-6 text-center text-xs text-neutral-500">
        No unit / price combinations have been added for this item yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unit / pack-size selector when there is more than one */}
      {unitPrices.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {unitPrices.map((up) => (
            <button
              key={up.id}
              type="button"
              onClick={() => setSelectedUnitPriceId(up.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                selectedUnitPrice?.id === up.id
                  ? "bg-secondary-600 text-white border-secondary-600"
                  : "bg-white text-neutral-600 border-cream-border hover:bg-cream-50"
              }`}
            >
              {up.sizeValue || `${up.measurement?.value} ${up.unitCode || up.measurement?.unit}`}
            </button>
          ))}
        </div>
      )}

      {/* 1. PRICING & GST BREAKDOWN CARD */}
      <div className="bg-white border border-cream-border rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-cream-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-secondary-600" />
            <h2 className="text-[15px] font-bold text-neutral-900 tracking-tight">
              Pricing Overview & Tax Breakdown
            </h2>
          </div>
          <span className="text-xs text-neutral-400">
            Prices are GST inclusive ({gstPercent}%)
          </span>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Base Price */}
          <div className="border-2 border-secondary-200 bg-secondary-50/40 rounded-xl p-4 flex flex-col justify-between gap-1 shadow-2xs">
            <span className="text-[11px] font-bold tracking-wider text-secondary-800 uppercase">
              Base Price
            </span>
            <span className="text-xl sm:text-2xl font-bold text-secondary-900 font-mono">
              ₹{basePrice.toLocaleString("en-IN")}.00
            </span>
            <span className="text-[11px] text-secondary-700 font-medium">
              Selling price on the storefront is computed from this minus any
              active offer/discount
            </span>
          </div>

          {/* SKU */}
          <div className="border border-cream-border rounded-xl p-4 bg-cream-50/40 flex flex-col justify-between gap-1">
            <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
              SKU
            </span>
            <span className="text-lg font-bold text-neutral-900 font-mono">
              {selectedUnitPrice?.sku}
            </span>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="border border-cream-border-subtle rounded-xl divide-y divide-cream-border-subtle bg-cream-50/30 text-xs sm:text-sm">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-neutral-500 font-medium">Taxable Value</span>
              <span className="font-bold text-neutral-900 font-mono">
                ₹{taxableValue.toLocaleString("en-IN")}.00
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-neutral-500 font-medium">
                GST @ {gstPercent}% (CGST {gstPercent / 2}% + SGST {gstPercent / 2}%)
              </span>
              <span className="font-bold text-neutral-900 font-mono">
                ₹{gstAmount.toLocaleString("en-IN")}.00
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 bg-secondary-50/60 font-semibold text-secondary-900">
              <span className="font-bold">Base Price (Inclusive of GST)</span>
              <span className="font-bold text-base font-mono">
                ₹{basePrice.toLocaleString("en-IN")}.00
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PRICE HISTORY CARD (GRAPH & TIMELINE LIST) */}
      <div className="bg-white border border-cream-border rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4.5 border-b border-cream-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-secondary-600" />
            <h2 className="text-[15px] font-bold text-neutral-900 tracking-tight">
              Price History & Timeline
            </h2>
          </div>

          <div className="flex items-center p-1 bg-cream-200 border border-cream-border rounded-xl gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("graph")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "graph"
                  ? "bg-secondary-600 text-cream-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Graph</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "list"
                  ? "bg-secondary-600 text-cream-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-white"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Timeline List</span>
            </button>
          </div>
        </div>

        {activeTab === "graph" && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="space-y-1">
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-bold text-neutral-900 font-mono">
                    ₹{basePrice.toLocaleString("en-IN")}.00
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Base price trend ·{" "}
                  {chartSeries.length <= 1
                    ? "current month"
                    : `monthly average, last ${chartSeries.length} months`}
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-cream-100 p-1 rounded-lg border border-cream-border shadow-2xs self-start sm:self-auto">
                {(["1Y"] as RangeOption[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      range === r
                        ? "bg-secondary-600 text-cream-white shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-cream-50/50 border border-cream-border p-5">
              <div className="flex items-end gap-3 sm:gap-6 h-40 pt-4 pb-2 border-b border-cream-border relative">
                {chartSeries.map((pt, idx) => {
                  const isLatest = idx === chartSeries.length - 1;
                  const isHot = hoveredIndex === idx;
                  const isFlat = maxVal === minVal;
                  const heightPercent = isFlat
                    ? 65
                    : Math.min(
                        100,
                        Math.max(28, 30 + ((pt.value - minVal) / span) * 65)
                      );

                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="flex-1 relative flex flex-col items-center justify-end h-full group cursor-pointer"
                    >
                      {isHot && (
                        <div
                          style={{ bottom: `${heightPercent}%` }}
                          className="absolute z-30 mb-2 left-1/2 -translate-x-1/2 rounded-xl bg-neutral-900 text-white px-3 py-1.5 text-center shadow-xl pointer-events-none whitespace-nowrap animate-in fade-in-0 duration-150"
                        >
                          <div className="text-[10px] text-neutral-300 font-medium">
                            {pt.fullDate}
                          </div>
                          <div className="text-xs font-bold font-mono text-emerald-400">
                            ₹{pt.value.toLocaleString("en-IN")}.00
                          </div>
                        </div>
                      )}

                      <span
                        className={`text-[10.5px] font-bold font-mono mb-1.5 transition-colors ${
                          isHot || isLatest
                            ? "text-secondary-900 font-bold"
                            : "text-neutral-400"
                        }`}
                      >
                        ₹{pt.value}
                      </span>

                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[48px] rounded-t-lg transition-all duration-200 ${
                          isHot
                            ? "bg-secondary-900 shadow-md scale-105"
                            : isLatest
                            ? "bg-secondary-600 shadow-xs"
                            : "bg-secondary-200 hover:bg-secondary-300"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 sm:gap-6 mt-2.5">
                {chartSeries.map((pt, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-[10.5px] font-semibold text-neutral-400 truncate"
                  >
                    {pt.date}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "list" && (
          <div className="p-6">
            {isLoadingHistory ? (
              <div className="py-12 text-center text-xs text-neutral-400">
                Loading price history timeline...
              </div>
            ) : rawHistoryList.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-2">
                <History className="w-8 h-8 text-neutral-300" />
                <p className="text-sm font-bold text-neutral-800">
                  Initial Price Recorded
                </p>
                <p className="text-xs text-neutral-400 max-w-sm">
                  This unit price is currently ₹{basePrice.toLocaleString("en-IN")}.
                  Historical revisions will appear here when the base price is
                  modified.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-cream-border">
                {rawHistoryList.map((item, idx) => {
                  const changedDateStr = item.changedAt
                    ? new Date(item.changedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "—";

                  const oldBase = item.oldPrice ?? item.oldBasePrice ?? null;
                  const newBase = item.newPrice ?? item.newBasePrice ?? null;

                  const isPriceReduced =
                    oldBase !== null && newBase !== null && newBase < oldBase;
                  const isPriceIncreased =
                    oldBase !== null && newBase !== null && newBase > oldBase;

                  return (
                    <div key={item.id || idx} className="relative group">
                      <span
                        className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
                          idx === 0
                            ? "bg-secondary-600 text-white"
                            : "bg-cream-200 text-neutral-500"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      </span>

                      <div className="rounded-xl border border-cream-border p-4 bg-white hover:bg-cream-50/50 transition-colors shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-neutral-900">
                              {newBase !== null && oldBase !== null
                                ? `Base Price: ₹${oldBase} → ₹${newBase}`
                                : newBase !== null
                                ? `Base Price set to ₹${newBase}`
                                : "Price Revised"}
                            </span>

                            {isPriceReduced && (
                              <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                <ArrowDownRight className="w-3 h-3 mr-0.5" />
                                Reduced
                              </span>
                            )}

                            {isPriceIncreased && (
                              <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                                Increased
                              </span>
                            )}
                          </div>

                          <span className="text-xs text-neutral-400 font-medium">
                            {changedDateStr}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                          <User className="w-3.5 h-3.5 opacity-60" />
                          <span>
                            Changed by:{" "}
                            <strong className="text-neutral-700">
                              {item.changedBy?.name || "Admin / Operations Team"}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default VariantPriceHistoryCard;
