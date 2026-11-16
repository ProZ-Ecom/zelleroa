"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, type SelectOption } from "@/components/ui/select";
import { toast } from "@/components/ui/Toast";
import { cn, formatPrice } from "@/lib/utils";
import * as api from "../api/pos.api";
import { useExecuteExchange, useProductSearch } from "../hooks/use-pos";
import { printExchangeReceipt } from "./PosReceipt";
import type {
  PosExchangeBillLookupDto,
  PosExchangeEligibleItem,
  PosExchangeReceiptDto,
  PosItemCondition,
  PosPaymentMode,
  PosProductOption,
  PosSessionDto,
  PosStoreDto,
} from "../types";
import { POS_EXCHANGE_REASONS } from "../types";

interface SelectedReturnItem {
  orderItemId: number;
  variantUnitPriceId: number;
  sku: string;
  productName: string;
  variantName: string;
  unitPrice: number; // Effective purchase price
  quantity: number;
  maxEligibleQuantity: number;
  condition: PosItemCondition;
  reason: string;
  reasonDetail: string;
}

interface SelectedReplacementItem {
  variantUnitPriceId: number;
  sku: string;
  label: string;
  unitPrice: number;
  quantity: number;
  sellable: number;
  isDefectiveReplacement?: boolean;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

const REASON_OPTIONS: SelectOption[] = POS_EXCHANGE_REASONS.map((r) => ({
  value: r,
  label: r,
}));

export function PosExchangeModal({
  open,
  onClose,
  store,
  session,
}: {
  open: boolean;
  onClose: () => void;
  store: PosStoreDto;
  session: PosSessionDto;
}) {
  // Step 1: Search & Bill Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundBills, setFoundBills] = useState<PosExchangeBillLookupDto[]>([]);
  const [selectedBill, setSelectedBill] = useState<PosExchangeBillLookupDto | null>(null);

  // Step 2: Return Items Selection
  const [returnCart, setReturnCart] = useState<Map<number, SelectedReturnItem>>(new Map());

  // Step 3: Replacement Cart
  const [replacementCart, setReplacementCart] = useState<SelectedReplacementItem[]>([]);
  const [skuSearchTerm, setSkuSearchTerm] = useState("");
  const [addingSku, setAddingSku] = useState(false);

  // Step 4: Settlement
  const [paymentMode, setPaymentMode] = useState<PosPaymentMode>("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [exchangeNotes, setExchangeNotes] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);

  const executeExchange = useExecuteExchange();
  const suggestions = useProductSearch(skuSearchTerm);

  // Focus search input on open
  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      // Reset state on close
      setSearchQuery("");
      setFoundBills([]);
      setSelectedBill(null);
      setReturnCart(new Map());
      setReplacementCart([]);
      setSkuSearchTerm("");
      setCashReceived("");
      setPaymentReference("");
      setExchangeNotes("");
    }
  }, [open]);

  // 1. Bill Search
  const handleSearchBills = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const results = await api.lookupExchangeBills(q);
      setFoundBills(results);
      if (results.length === 1) {
        setSelectedBill(results[0]);
        setReturnCart(new Map());
      } else if (results.length === 0) {
        toast.error(`No eligible bill found for "${q}" at this store`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bill lookup failed");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // 2. Return Item Toggle / Change
  const toggleReturnItem = (item: PosExchangeEligibleItem) => {
    setReturnCart((curr) => {
      const next = new Map(curr);
      if (next.has(item.orderItemId)) {
        next.delete(item.orderItemId);
      } else {
        next.set(item.orderItemId, {
          orderItemId: item.orderItemId,
          variantUnitPriceId: item.variantUnitPriceId,
          sku: item.sku,
          productName: item.productName,
          variantName: item.variantName,
          unitPrice: item.effectiveUnitPrice,
          quantity: 1,
          maxEligibleQuantity: item.eligibleQuantity,
          condition: "RESTOCKABLE",
          reason: "Size Issue",
          reasonDetail: "",
        });
      }
      return next;
    });
  };

  const updateReturnItemQuantity = (orderItemId: number, qty: number) => {
    setReturnCart((curr) => {
      const item = curr.get(orderItemId);
      if (!item) return curr;
      const next = new Map(curr);
      const safeQty = Math.min(Math.max(1, qty), item.maxEligibleQuantity);
      next.set(orderItemId, { ...item, quantity: safeQty });
      return next;
    });
  };

  const updateReturnItemCondition = (orderItemId: number, condition: PosItemCondition) => {
    setReturnCart((curr) => {
      const item = curr.get(orderItemId);
      if (!item) return curr;
      const next = new Map(curr);
      next.set(orderItemId, { ...item, condition });
      return next;
    });
  };

  const updateReturnItemReason = (orderItemId: number, reason: string, reasonDetail?: string) => {
    setReturnCart((curr) => {
      const item = curr.get(orderItemId);
      if (!item) return curr;
      const next = new Map(curr);
      next.set(orderItemId, {
        ...item,
        reason,
        reasonDetail: reasonDetail !== undefined ? reasonDetail : item.reasonDetail,
      });
      return next;
    });
  };

  // 1-Click Same-Product Defective Replacement
  const handleSameProductReplacement = async (item: PosExchangeEligibleItem) => {
    try {
      // 1. Select the defective return item
      setReturnCart((curr) => {
        const next = new Map(curr);
        next.set(item.orderItemId, {
          orderItemId: item.orderItemId,
          variantUnitPriceId: item.variantUnitPriceId,
          sku: item.sku,
          productName: item.productName,
          variantName: item.variantName,
          unitPrice: item.effectiveUnitPrice,
          quantity: 1,
          maxEligibleQuantity: item.eligibleQuantity,
          condition: "DEFECTIVE",
          reason: "Product Defect",
          reasonDetail: "Manufacturing defect replacement",
        });
        return next;
      });

      // 2. Lookup the identical SKU for replacement
      const exactSku = await api.findBySku(item.sku);
      if (!exactSku) {
        toast.error(`Replacement SKU ${item.sku} is no longer in catalog`);
        return;
      }
      if (exactSku.sellable < 1) {
        toast.error(`Cannot issue replacement: ${item.sku} is out of stock`);
        return;
      }

      // 3. Add to replacement cart
      setReplacementCart((curr) => {
        const existingIdx = curr.findIndex((l) => l.variantUnitPriceId === exactSku.variantUnitPriceId);
        if (existingIdx >= 0) {
          const updated = [...curr];
          updated[existingIdx].quantity += 1;
          return updated;
        }
        return [
          ...curr,
          {
            variantUnitPriceId: exactSku.variantUnitPriceId,
            sku: exactSku.sku,
            label: exactSku.label,
            unitPrice: exactSku.unitPrice,
            quantity: 1,
            sellable: exactSku.sellable,
            isDefectiveReplacement: true,
          },
        ];
      });

      toast.success(`Defective item & identical replacement added at ₹0 additional payment`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add same-product replacement");
    }
  };

  // 3. Add Replacement Line
  const addReplacementOption = (option: PosProductOption) => {
    if (option.sellable < 1) {
      toast.error(`${option.sku} is out of stock`);
      return;
    }
    setReplacementCart((curr) => {
      const idx = curr.findIndex((l) => l.variantUnitPriceId === option.variantUnitPriceId);
      if (idx >= 0) {
        if (curr[idx].quantity >= option.sellable) {
          toast.error(`Only ${option.sellable} in stock`);
          return curr;
        }
        const updated = [...curr];
        updated[idx].quantity += 1;
        return updated;
      }
      return [
        ...curr,
        {
          variantUnitPriceId: option.variantUnitPriceId,
          sku: option.sku,
          label: option.label,
          unitPrice: option.unitPrice,
          quantity: 1,
          sellable: option.sellable,
        },
      ];
    });
    setSkuSearchTerm("");
    skuInputRef.current?.focus();
  };

  const handleScanSku = async () => {
    const val = skuSearchTerm.trim();
    if (!val || addingSku) return;
    setAddingSku(true);
    try {
      const exact = await api.findBySku(val);
      if (exact) {
        addReplacementOption(exact);
        return;
      }
      const matches = await api.searchProducts(val);
      if (matches.length === 1) {
        addReplacementOption(matches[0]);
        return;
      }
      if (matches.length === 0) {
        toast.error(`No product found for SKU "${val}"`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setAddingSku(false);
    }
  };

  const removeReplacementLine = (variantUnitPriceId: number) => {
    setReplacementCart((curr) => curr.filter((l) => l.variantUnitPriceId !== variantUnitPriceId));
  };

  const updateReplacementQuantity = (variantUnitPriceId: number, qty: number) => {
    setReplacementCart((curr) =>
      curr.map((l) =>
        l.variantUnitPriceId === variantUnitPriceId
          ? { ...l, quantity: Math.min(Math.max(1, qty), l.sellable) }
          : l
      )
    );
  };

  // Value Calculations
  const totalReturnCredit = useMemo(() => {
    let sum = 0;
    for (const item of returnCart.values()) {
      sum += item.unitPrice * item.quantity;
    }
    return round2(sum);
  }, [returnCart]);

  const totalReplacementValue = useMemo(() => {
    return round2(
      replacementCart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
    );
  }, [replacementCart]);

  const netDifference = round2(totalReplacementValue - totalReturnCredit);
  const isLowerValue = netDifference < 0;
  const deficitAmount = Math.abs(netDifference);

  // Cash change due
  const cashNum = parseFloat(cashReceived) || 0;
  const changeDue = netDifference > 0 && paymentMode === "CASH" ? Math.max(0, round2(cashNum - netDifference)) : 0;

  // Final Exchange Submission
  const handleCompleteExchange = async () => {
    if (!selectedBill) return;
    if (returnCart.size === 0) {
      toast.error("Please select at least one item to return");
      return;
    }
    if (replacementCart.length === 0) {
      toast.error("Please select at least one replacement item");
      return;
    }

    // Enforce Lower-Value Rule: Mandatory Full Value Utilization
    if (isLowerValue) {
      toast.error(
        `Cannot complete exchange: customer must select additional products worth ${formatPrice(deficitAmount)}.`
      );
      return;
    }

    if (netDifference > 0 && paymentMode === "CASH" && cashNum < netDifference) {
      toast.error(`Cash received (${formatPrice(cashNum)}) is less than net payable (${formatPrice(netDifference)})`);
      return;
    }

    // Check "Other" reason descriptions
    for (const ret of returnCart.values()) {
      if (ret.reason === "Other" && !ret.reasonDetail.trim()) {
        toast.error(`Please provide a description for the "Other" reason on ${ret.sku}`);
        return;
      }
    }

    try {
      const receipt = await executeExchange.mutateAsync({
        originalOrderId: selectedBill.orderId,
        returnItems: Array.from(returnCart.values()).map((r) => ({
          orderItemId: r.orderItemId,
          quantity: r.quantity,
          condition: r.condition,
          reason: r.reason,
          reasonDetail: r.reasonDetail.trim() || null,
        })),
        newItems: replacementCart.map((n) => ({
          variantUnitPriceId: n.variantUnitPriceId,
          quantity: n.quantity,
          isDefectiveReplacement: n.isDefectiveReplacement,
        })),
        paymentMode: netDifference > 0 ? paymentMode : null,
        cashReceived: netDifference > 0 && paymentMode === "CASH" ? cashNum : null,
        paymentReference: paymentReference.trim() || null,
        notes: exchangeNotes.trim() || null,
      });

      // Auto-print thermal exchange receipt
      printExchangeReceipt(receipt);
      onClose();
    } catch {
      // Error handled by mutation hook toast
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Returns & Exchanges"
      description={`${store.name} · Shift: ${session.staffName}`}
      className="max-w-4xl"
    >
      <div className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1">
        {/* STEP 1: BILL SEARCH & SELECTION */}
        {!selectedBill ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Search Original Purchase <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter Invoice # (e.g. ZEL/26-27/0042) or Customer 10-digit Phone"
                    className="pl-9 h-11"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSearchBills();
                      }
                    }}
                  />
                </div>
                <Button onClick={handleSearchBills} disabled={searching || !searchQuery.trim()} className="h-11 px-5">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find Bill"}
                </Button>
              </div>
            </div>

            {/* Multiple bills list if searched by phone */}
            {foundBills.length > 1 && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-xs font-medium text-neutral-500">
                  Multiple bills found for this customer. Select one to proceed:
                </p>
                <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                  {foundBills.map((bill) => (
                    <div
                      key={bill.orderId}
                      className="flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-sm text-neutral-900">
                          {bill.invoiceNumber || bill.orderNumber}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {new Date(bill.placedAt).toLocaleDateString("en-IN")} · {bill.items.length} items · Paid{" "}
                          {formatPrice(bill.totalAmount)} ({bill.paymentMode})
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBill(bill);
                          setReturnCart(new Map());
                        }}
                      >
                        Select Bill
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Header info of selected bill */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 p-3.5 border border-neutral-200 text-xs">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedBill(null)}
                  className="h-8 px-2 text-neutral-500 hover:text-neutral-900"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Change Bill
                </Button>
                <div>
                  <span className="font-semibold text-neutral-900 text-sm">
                    {selectedBill.invoiceNumber || selectedBill.orderNumber}
                  </span>
                  <span className="text-neutral-500 ml-2">
                    ({new Date(selectedBill.placedAt).toLocaleDateString("en-IN")})
                  </span>
                </div>
              </div>
              <div className="text-right text-neutral-600">
                <span>{selectedBill.customerName || "Walk-in Customer"}</span>
                {selectedBill.customerPhone && <span className="ml-2 font-mono">({selectedBill.customerPhone})</span>}
              </div>
            </div>

            {/* STEP 2: SELECT RETURN ITEMS */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
                  1. Select Products to Return / Exchange
                </h3>
                <span className="text-xs text-neutral-500">
                  {returnCart.size} {returnCart.size === 1 ? "item" : "items"} selected
                </span>
              </div>

              <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                {selectedBill.items.map((item) => {
                  const isSelected = returnCart.has(item.orderItemId);
                  const selectedData = returnCart.get(item.orderItemId);
                  const isFullyExchanged = item.eligibleQuantity <= 0;

                  return (
                    <div
                      key={item.orderItemId}
                      className={cn(
                        "p-4 transition-colors",
                        isSelected ? "bg-amber-50/40" : isFullyExchanged ? "bg-neutral-50/60 opacity-60" : ""
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            disabled={isFullyExchanged}
                            checked={isSelected}
                            onChange={() => toggleReturnItem(item)}
                            className="mt-1 h-4 w-4 rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <p className="font-semibold text-sm text-neutral-900">
                              {item.productName}{" "}
                              <span className="font-normal text-neutral-500">({item.variantName})</span>
                            </p>
                            <p className="text-xs text-neutral-500 font-mono mt-0.5">SKU: {item.sku}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 mt-1">
                              <span>Purchased: {item.purchasedQuantity}</span>
                              {item.alreadyExchangedQuantity > 0 && (
                                <span className="text-neutral-400">Exchanged: {item.alreadyExchangedQuantity}</span>
                              )}
                              <span className="font-medium text-neutral-700">
                                Eligible: {item.eligibleQuantity}
                              </span>
                              <span className="font-medium text-emerald-700">
                                Paid Unit Price: {formatPrice(item.effectiveUnitPrice)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Defective Replacement shortcut */}
                        {!isFullyExchanged && (
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleSameProductReplacement(item)}
                              className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50"
                              title="Customer reported defect: issue identical replacement at ₹0"
                            >
                              <AlertTriangle className="h-3.5 w-3.5 mr-1 text-red-500" />
                              Defect Replacement
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Selected item configuration options */}
                      {isSelected && selectedData && (
                        <div className="mt-3.5 pt-3 border-t border-amber-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          {/* Quantity stepper */}
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-600 uppercase mb-1">
                              Return Quantity <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={selectedData.quantity <= 1}
                                onClick={() => updateReturnItemQuantity(item.orderItemId, selectedData.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center font-bold text-sm tabular-nums">
                                {selectedData.quantity}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={selectedData.quantity >= selectedData.maxEligibleQuantity}
                                onClick={() => updateReturnItemQuantity(item.orderItemId, selectedData.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <span className="text-neutral-400 text-[10px] ml-1">
                                (Max {selectedData.maxEligibleQuantity})
                              </span>
                            </div>
                          </div>

                          {/* Condition */}
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-600 uppercase mb-1">
                              Product Condition <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => updateReturnItemCondition(item.orderItemId, "RESTOCKABLE")}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                                  selectedData.condition === "RESTOCKABLE"
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                    : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                                )}
                              >
                                Sellable
                              </button>
                              <button
                                type="button"
                                onClick={() => updateReturnItemCondition(item.orderItemId, "DEFECTIVE")}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                                  selectedData.condition === "DEFECTIVE"
                                    ? "bg-red-50 border-red-300 text-red-800"
                                    : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                                )}
                              >
                                Defective (Damaged)
                              </button>
                            </div>
                          </div>

                          {/* Reason */}
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-600 uppercase mb-1">
                              Reason <span className="text-red-500">*</span>
                            </label>
                            <Select
                              value={selectedData.reason}
                              onValueChange={(val) => updateReturnItemReason(item.orderItemId, val)}
                              options={REASON_OPTIONS}
                              searchable={false}
                              portal={true}
                              size="sm"
                              className="h-8 text-xs"
                            />
                            {selectedData.reason === "Other" && (
                              <div className="mt-1.5">
                                <label className="block text-[10px] font-semibold text-neutral-600 uppercase mb-0.5">
                                  Specify Reason <span className="text-red-500">*</span>
                                </label>
                                <Input
                                  value={selectedData.reasonDetail}
                                  onChange={(e) =>
                                    updateReturnItemReason(item.orderItemId, "Other", e.target.value)
                                  }
                                  placeholder="Enter reason description (required)..."
                                  className="h-7 text-xs"
                                  required
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 3: REPLACEMENT CART */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-2">
                  <ShoppingBag className="h-3.5 w-3.5 text-stone-900" />
                  2. Select Replacement Products
                </h3>
                <span className="text-xs text-neutral-500">
                  {replacementCart.length} {replacementCart.length === 1 ? "item" : "items"} in cart
                </span>
              </div>

              {/* SKU Scanner / Product Search */}
              <div className="relative">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  ref={skuInputRef}
                  value={skuSearchTerm}
                  onChange={(e) => setSkuSearchTerm(e.target.value)}
                  placeholder="Scan SKU barcode or type product name to add replacement..."
                  className="pl-9 h-11"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleScanSku();
                    }
                  }}
                />
                {addingSku && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />
                )}

                {/* Suggestions drop */}
                {skuSearchTerm.trim().length >= 2 && (suggestions.data?.length ?? 0) > 0 && (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
                    {suggestions.data!.map((opt) => (
                      <button
                        key={opt.variantUnitPriceId}
                        type="button"
                        onClick={() => addReplacementOption(opt)}
                        disabled={opt.sellable < 1}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs hover:bg-neutral-50 disabled:opacity-50"
                      >
                        <div>
                          <p className="font-medium text-neutral-900">{opt.label}</p>
                          <p className="font-mono text-[11px] text-neutral-400">SKU: {opt.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-neutral-900">{formatPrice(opt.unitPrice)}</p>
                          <span className="text-[10px] text-neutral-500">{opt.sellable} in stock</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Replacement items table */}
              {replacementCart.length > 0 ? (
                <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                  {replacementCart.map((line) => (
                    <div key={line.variantUnitPriceId} className="flex items-center justify-between p-3 text-xs">
                      <div>
                        <p className="font-semibold text-neutral-900">{line.label}</p>
                        <p className="font-mono text-neutral-400 text-[11px]">SKU: {line.sku}</p>
                        {line.isDefectiveReplacement && (
                          <span className="inline-block mt-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 text-[10px]">
                            Identical Replacement
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            disabled={line.quantity <= 1}
                            onClick={() => updateReplacementQuantity(line.variantUnitPriceId, line.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-bold tabular-nums">{line.quantity}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            disabled={line.quantity >= line.sellable}
                            onClick={() => updateReplacementQuantity(line.variantUnitPriceId, line.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="text-right min-w-[70px]">
                          <p className="font-bold text-neutral-900">
                            {formatPrice(round2(line.unitPrice * line.quantity))}
                          </p>
                          <p className="text-[10px] text-neutral-400">{formatPrice(line.unitPrice)} each</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeReplacementLine(line.variantUnitPriceId)}
                          className="rounded p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-xs text-neutral-400">
                  Scan barcodes or search replacement products above to build the exchange cart.
                </div>
              )}
            </div>

            {/* STEP 4: SUMMARY & POLICY ENFORCEMENT */}
            <div className="rounded-2xl bg-neutral-900 text-white p-5 shadow-lg flex flex-col gap-4">
              <div className="flex flex-col gap-2 border-b border-neutral-800 pb-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Total Return Credit</span>
                  <span className="font-semibold text-emerald-400">-{formatPrice(totalReturnCredit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Total Replacement Products</span>
                  <span className="font-semibold text-neutral-200">+{formatPrice(totalReplacementValue)}</span>
                </div>
                <div className="flex items-end justify-between pt-2 border-t border-neutral-800">
                  <span className="text-sm font-semibold">Net Difference</span>
                  <span
                    className={cn(
                      "text-2xl font-bold tabular-nums leading-none",
                      isLowerValue ? "text-amber-400" : netDifference > 0 ? "text-[#D4AF37]" : "text-emerald-400"
                    )}
                  >
                    {isLowerValue ? `-${formatPrice(deficitAmount)}` : formatPrice(netDifference)}
                  </span>
                </div>
              </div>

              {/* CRITICAL POLICY WARNING (Scenario 3: Lower-Value Exchange) */}
              {isLowerValue && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-300">Mandatory Full Value Utilization Required</p>
                    <p className="mt-1 leading-relaxed text-amber-200/90">
                      Your exchange balance is {formatPrice(totalReturnCredit)}. Please select additional products
                      worth at least <span className="font-bold underline">{formatPrice(deficitAmount)}</span> to
                      complete the exchange. Unused exchange balance cannot be refunded or converted into a voucher or
                      store credit.
                    </p>
                  </div>
                </div>
              )}

              {/* Higher-Value Payment Mode Selection */}
              {netDifference > 0 && (
                <div className="flex flex-col gap-3 pt-1">
                  <label className="text-xs font-semibold uppercase text-neutral-400">
                    Collect Additional Payment: {formatPrice(netDifference)} <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["CASH", "UPI", "CARD"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-semibold border transition-all",
                          paymentMode === mode
                            ? "bg-white text-neutral-900 border-white"
                            : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700"
                        )}
                      >
                        {mode === "CASH" && <Banknote className="h-3.5 w-3.5" />}
                        {mode === "UPI" && <Smartphone className="h-3.5 w-3.5" />}
                        {mode === "CARD" && <CreditCard className="h-3.5 w-3.5" />}
                        {mode}
                      </button>
                    ))}
                  </div>

                  {paymentMode === "CASH" && (
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1">
                        <label className="block text-[10px] text-neutral-400 uppercase mb-1">
                          Cash Received <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder={`Min ${netDifference}`}
                          className="bg-neutral-800 border-neutral-700 text-white h-9 text-sm"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] text-neutral-400 uppercase mb-1">Change Due</label>
                        <p className="text-lg font-bold text-emerald-400 tabular-nums leading-9">
                          {formatPrice(changeDue)}
                        </p>
                      </div>
                    </div>
                  )}

                  {paymentMode !== "CASH" && (
                    <Input
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder={`Enter ${paymentMode} reference ID / Approval Code`}
                      className="bg-neutral-800 border-neutral-700 text-white h-9 text-xs"
                    />
                  )}
                </div>
              )}

              {/* Complete Exchange Button */}
              <Button
                type="button"
                disabled={
                  executeExchange.isPending ||
                  returnCart.size === 0 ||
                  replacementCart.length === 0 ||
                  isLowerValue
                }
                onClick={handleCompleteExchange}
                className={cn(
                  "h-12 w-full text-base font-bold rounded-xl transition-all",
                  isLowerValue
                    ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    : "bg-[#D4AF37] text-neutral-900 hover:bg-[#c49f27]"
                )}
              >
                {executeExchange.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-neutral-900" />
                ) : isLowerValue ? (
                  `Add ${formatPrice(deficitAmount)} more to complete exchange`
                ) : netDifference === 0 ? (
                  "Complete Exchange (₹0 Additional)"
                ) : (
                  `Pay ${formatPrice(netDifference)} & Complete Exchange`
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
