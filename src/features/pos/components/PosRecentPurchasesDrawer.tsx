"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Printer,
  Search,
  ShoppingBag,
  Smartphone,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { useRecentBills } from "../hooks/use-pos";
import * as api from "../api/pos.api";
import { printReceipt } from "./PosReceipt";
import { PosPurchaseDetailModal } from "./PosPurchaseDetailModal";
import type { PosPaymentMode } from "../types";

interface PosRecentPurchasesDrawerProps {
  open: boolean;
  onClose: () => void;
}

const PAYMENT_ICONS: Record<PosPaymentMode, typeof Banknote> = {
  CASH: Banknote,
  UPI: Smartphone,
  CARD: CreditCard,
};

export function PosRecentPurchasesDrawer({ open, onClose }: PosRecentPurchasesDrawerProps) {
  const { data: bills = [], isLoading, refetch } = useRecentBills(open);
  const [search, setSearch] = useState("");
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [isSelectedVoided, setIsSelectedVoided] = useState(false);
  const [printingUuid, setPrintingUuid] = useState<string | null>(null);

  const filteredBills = useMemo(() => {
    if (!search.trim()) return bills;
    const term = search.toLowerCase().trim();
    return bills.filter((b) => {
      return (
        b.orderNumber.toLowerCase().includes(term) ||
        (b.invoiceNumber && b.invoiceNumber.toLowerCase().includes(term)) ||
        (b.customerName && b.customerName.toLowerCase().includes(term)) ||
        (b.customerPhone && b.customerPhone.includes(term))
      );
    });
  }, [bills, search]);

  const handleQuickPrint = async (e: React.MouseEvent, uuid: string | null) => {
    e.stopPropagation();
    if (!uuid) return;
    setPrintingUuid(uuid);
    try {
      const detail = await api.getPurchaseDetail(uuid);
      printReceipt(detail);
    } catch {
      // toast or silent error
    } finally {
      setPrintingUuid(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />

        {/* Slide-in panel */}
        <div className="relative z-10 flex h-full w-full max-w-full sm:max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-bold text-neutral-900">Shift Purchases</h2>
                <p className="text-xs text-neutral-500">
                  {bills.length} {bills.length === 1 ? "bill" : "bills"} rung in current shift
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="border-b border-neutral-100 px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice, customer phone or name..."
                className="h-9 pl-9 text-xs"
                autoFocus
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {isLoading && bills.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                <p className="text-xs text-neutral-500">Loading recent purchases...</p>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 p-6 text-center">
                <ShoppingBag className="h-8 w-8 text-neutral-300" />
                <p className="text-sm font-semibold text-neutral-800">
                  {search ? "No matching purchases" : "No purchases yet"}
                </p>
                <p className="text-xs text-neutral-500">
                  {search
                    ? "Try searching for a different number or customer name"
                    : "Completed counter bills will show up here"}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredBills.map((b) => {
                  const PaymentIcon = b.paymentMode ? PAYMENT_ICONS[b.paymentMode] : Banknote;
                  return (
                    <div
                      key={b.orderUuid || b.orderNumber}
                      onClick={() => {
                        if (b.orderUuid) {
                          setSelectedUuid(b.orderUuid);
                          setIsSelectedVoided(b.voided);
                        }
                      }}
                      className={cn(
                        "group cursor-pointer rounded-xl border p-3.5 transition-all hover:border-neutral-300 hover:shadow-sm",
                        b.voided
                          ? "border-red-100 bg-red-50/30"
                          : "border-neutral-200 bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-neutral-900 text-sm">
                              {b.invoiceNumber || b.orderNumber}
                            </span>
                            {b.voided ? (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                Voided
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                                Done
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            {b.billedAt ? formatDateTime(b.billedAt) : "Just now"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className={cn("text-sm font-bold tabular-nums", b.voided ? "line-through text-neutral-400" : "text-neutral-900")}>
                            {formatPrice(b.totalAmount)}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
                            <PaymentIcon className="h-3 w-3" />
                            {b.paymentMode || "CASH"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-600">
                        <span className="truncate max-w-[200px]">
                          {b.customerName || "Walk-in"}
                          {b.customerPhone ? ` · ${b.customerPhone}` : ""}
                        </span>

                        <div className="flex items-center gap-1">
                          {b.orderUuid && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-neutral-600 hover:bg-neutral-100"
                              onClick={(e) => handleQuickPrint(e, b.orderUuid)}
                              title="Print receipt"
                              disabled={printingUuid === b.orderUuid}
                            >
                              {printingUuid === b.orderUuid ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Printer className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer link to full purchases history */}
          <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-3">
            <Link
              href="/admin/dashboard/orders/pos"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white py-2 text-xs font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-100"
            >
              <span>View All Store Purchases</span>
              <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bill detail modal */}
      {selectedUuid && (
        <PosPurchaseDetailModal
          open={Boolean(selectedUuid)}
          orderUuid={selectedUuid}
          isVoided={isSelectedVoided}
          onClose={() => setSelectedUuid(null)}
          onVoidSuccess={() => {
            void refetch();
          }}
        />
      )}
    </>
  );
}
