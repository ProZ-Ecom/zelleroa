"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ScanLine,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/Toast";
import { cn, formatPrice } from "@/lib/utils";
import { useCan } from "@/features/access";
import * as api from "../api/pos.api";
import { useCreateBill, useProductSearch } from "../hooks/use-pos";
import { printReceipt } from "./PosReceipt";
import type { PosBillDto, PosPaymentMode, PosProductOption, PosSessionDto, PosStoreDto } from "../types";

interface CartLine {
  variantUnitPriceId: number;
  sku: string;
  label: string;
  unitPrice: number;
  quantity: number;
  sellable: number;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * The counter keypad.
 *
 * Built around one text box that never loses focus: a cashier types a SKU,
 * presses Enter, and the item is on the bill. Everything else - quantity,
 * discount, payment - is a function key, because a till queue is measured in
 * seconds and reaching for a mouse per item is what makes a POS feel slow.
 */
export function PosBillingScreen({
  session,
  store,
  onCloseShift,
}: {
  session: PosSessionDto;
  store: PosStoreDto;
  onCloseShift: () => void;
}) {
  const [term, setTerm] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "found" | "new">("idle");
  const [payOpen, setPayOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [lastBill, setLastBill] = useState<PosBillDto | null>(null);
  const [adding, setAdding] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  /** Briefly ringed so the cashier can see which line their SKU landed on. */
  const [justAdded, setJustAdded] = useState<number | null>(null);

  const skuInput = useRef<HTMLInputElement>(null);
  const cartEnd = useRef<HTMLDivElement>(null);
  const createBill = useCreateBill();
  const mayDiscount = useCan("POS_DISCOUNT");

  // A SKU is exact; anything else is treated as a name fragment and offered as
  // a list. Two characters is where a list stops being the whole catalogue.
  const suggestions = useProductSearch(term);

  const focusSku = useCallback(() => {
    // Defer so the click or key that triggered this finishes first.
    window.setTimeout(() => skuInput.current?.focus(), 0);
  }, []);

  useEffect(() => focusSku(), [focusSku]);

  // Drop the highlight on its own; the cashier should not have to do anything.
  useEffect(() => {
    if (justAdded === null) return;
    const timer = window.setTimeout(() => setJustAdded(null), 1200);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  const subtotal = useMemo(
    () => round2(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)),
    [lines]
  );
  const total = round2(Math.max(0, subtotal - discount));
  const totalUnits = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  const addLine = useCallback(
    (option: PosProductOption) => {
      if (option.sellable < 1) {
        toast.error(`${option.sku} is out of stock`);
        return;
      }

      setLines((current) => {
        const existing = current.find((l) => l.variantUnitPriceId === option.variantUnitPriceId);
        if (existing) {
          // Scanning the same item again means "one more", and saying so out
          // loud saves the cashier hunting for which line moved.
          toast.success(`${option.sku} × ${existing.quantity + 1}`);
          return current.map((l) =>
            l.variantUnitPriceId === option.variantUnitPriceId
              ? { ...l, quantity: l.quantity + 1 }
              : l
          );
        }
        return [
          ...current,
          {
            variantUnitPriceId: option.variantUnitPriceId,
            sku: option.sku,
            label: option.label || option.productName,
            unitPrice: option.unitPrice,
            quantity: 1,
            sellable: option.sellable,
          },
        ];
      });
      setJustAdded(option.variantUnitPriceId);
      setTerm("");
      focusSku();
      // Keep the newest line in view on a long bill.
      window.setTimeout(() => cartEnd.current?.scrollIntoView({ block: "nearest" }), 0);
    },
    [focusSku]
  );

  /** Enter in the SKU box: exact match goes straight on the bill. */
  const submitTerm = useCallback(async () => {
    const value = term.trim();
    if (!value || adding) return;

    setAdding(true);
    try {
      const exact = await api.findBySku(value);
      if (exact) {
        addLine(exact);
        return;
      }
      const matches = await api.searchProducts(value);
      if (matches.length === 1) {
        addLine(matches[0]);
        return;
      }
      if (matches.length === 0) toast.error(`Nothing found for "${value}" — check the SKU`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed");
    } finally {
      setAdding(false);
    }
  }, [term, adding, addLine]);

  const setQuantity = (id: number, quantity: number) => {
    setLines((current) =>
      current
        .map((line) =>
          line.variantUnitPriceId === id
            ? // Never let the box go above what the counter can actually sell,
              // so the cashier finds out here and not after pressing Pay.
              { ...line, quantity: Math.min(Math.max(0, quantity), line.sellable) }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
    focusSku();
  };

  const bump = (line: CartLine, by: number) => {
    if (by > 0 && line.quantity >= line.sellable) {
      toast.error(`Only ${line.sellable} of ${line.sku} in stock`);
      return;
    }
    setQuantity(line.variantUnitPriceId, line.quantity + by);
  };

  const clearCart = useCallback(() => {
    setLines([]);
    setDiscount(0);
    setCustomerPhone("");
    setCustomerName("");
    setLookupState("idle");
    focusSku();
  }, [focusSku]);

  // Function keys. Bound on the window so they work wherever focus sits, and
  // suppressed while a dialog is open so typing in it is not hijacked.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (payOpen || discountOpen || clearConfirm) return;
      if (event.key === "F9") {
        event.preventDefault();
        if (lines.length > 0) setPayOpen(true);
      } else if (event.key === "F4") {
        event.preventDefault();
        if (lines.length > 0 && mayDiscount) setDiscountOpen(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        // Esc used to wipe the bill outright. One mis-hit mid-queue meant
        // re-scanning everything, so it asks first now.
        if (lines.length > 0) setClearConfirm(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [payOpen, discountOpen, clearConfirm, lines.length, mayDiscount]);

  const lookupPhone = async (phone: string) => {
    if (!/^\d{10}$/.test(phone)) {
      setLookupState("idle");
      return;
    }
    try {
      const result = await api.lookupCustomer(phone);
      if (result.found) {
        setCustomerName(result.name ?? "");
        setLookupState("found");
      } else {
        setLookupState("new");
      }
    } catch {
      setLookupState("idle");
    }
  };

  const pay = async (mode: PosPaymentMode, cashReceived?: number, reference?: string) => {
    const bill = await createBill.mutateAsync({
      items: lines.map((line) => ({
        variantUnitPriceId: line.variantUnitPriceId,
        quantity: line.quantity,
      })),
      discountAmount: discount,
      customerPhone: /^\d{10}$/.test(customerPhone) ? customerPhone : undefined,
      customerName: customerName.trim() || undefined,
      paymentMode: mode,
      cashReceived,
      paymentReference: reference,
    });

    setPayOpen(false);
    setLastBill(bill);
    printReceipt(bill);
    clearCart();
    toast.success(`${bill.invoiceNumber} · ${formatPrice(bill.totalAmount)}`);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4 lg:flex-row">
      {/* Left: entry and lines */}
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{store.name}</p>
            <p className="text-xs text-neutral-500">
              {session.staffName} · shift since{" "}
              {new Date(session.openedAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCloseShift}>
            Close shift
          </Button>
        </div>

        <div className="relative">
          <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <Input
            ref={skuInput}
            value={term}
            placeholder="Type SKU and press Enter, or search by name"
            className="h-14 pl-11 text-base"
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitTerm();
              }
            }}
          />
          {adding && (
            <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-neutral-400" />
          )}

          {term.trim().length >= 2 && (suggestions.data?.length ?? 0) > 0 && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
              {suggestions.data!.map((option) => (
                <button
                  type="button"
                  key={option.variantUnitPriceId}
                  onClick={() => addLine(option)}
                  disabled={option.sellable < 1}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    <span className="font-medium text-neutral-900">{option.label}</span>
                    <span className="ml-2 font-mono text-xs text-neutral-500">{option.sku}</span>
                  </span>
                  <span className="flex items-center gap-3 text-xs">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5",
                        option.sellable < 1
                          ? "bg-red-50 text-red-600"
                          : option.sellable <= 3
                            ? "bg-amber-50 text-amber-700"
                            : "bg-neutral-100 text-neutral-600"
                      )}
                    >
                      {option.sellable < 1 ? "Out of stock" : `${option.sellable} left`}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatPrice(option.unitPrice)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-50">
                <ScanLine className="h-7 w-7 text-neutral-300" />
              </span>
              <p className="text-sm font-medium text-neutral-600">No items yet</p>
              <p className="mt-1 max-w-xs text-xs text-neutral-400">
                Type a SKU in the box above and press Enter. Same item again adds one more.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="py-2">Item</th>
                  <th className="w-36 py-2 text-center">Qty</th>
                  <th className="w-24 py-2 text-right">Rate</th>
                  <th className="w-28 py-2 text-right">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={line.variantUnitPriceId}
                    className={cn(
                      "border-t border-neutral-100 transition-colors",
                      justAdded === line.variantUnitPriceId && "bg-emerald-50/60"
                    )}
                  >
                    <td className="py-2.5">
                      <p className="font-medium text-neutral-900">{line.label}</p>
                      <p className="font-mono text-xs text-neutral-500">{line.sku}</p>
                      {line.quantity >= line.sellable && (
                        <p className="mt-0.5 text-xs text-amber-700">
                          That is all {line.sellable} in stock
                        </p>
                      )}
                    </td>
                    <td className="py-2.5">
                      <div className="mx-auto flex w-32 items-center justify-center gap-1">
                        <StepButton
                          label={`One less ${line.sku}`}
                          onClick={() => bump(line, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </StepButton>
                        <Input
                          type="number"
                          min={1}
                          max={line.sellable}
                          value={line.quantity}
                          aria-label={`Quantity of ${line.sku}`}
                          className="h-10 w-14 px-1 text-center text-base font-semibold"
                          onChange={(event) =>
                            setQuantity(line.variantUnitPriceId, Number(event.target.value))
                          }
                        />
                        <StepButton
                          label={`One more ${line.sku}`}
                          disabled={line.quantity >= line.sellable}
                          onClick={() => bump(line, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </StepButton>
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatPrice(line.unitPrice)}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">
                      {formatPrice(round2(line.unitPrice * line.quantity))}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`Remove ${line.sku}`}
                        onClick={() => setQuantity(line.variantUnitPriceId, 0)}
                        className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div ref={cartEnd} />
        </div>

        {/* The shortcuts spelled out, so nobody has to be told them twice. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-[11px] text-neutral-400">
          <Hint keyName="Enter">add item</Hint>
          <Hint keyName="F4">discount</Hint>
          <Hint keyName="F9">pay</Hint>
          <Hint keyName="Esc">clear bill</Hint>
        </div>
      </div>

      {/* Right: customer, totals, pay */}
      <div className="flex w-full flex-col gap-4 lg:w-80">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04]">
          <label className="mb-1.5 block text-xs font-medium uppercase text-neutral-500">
            Customer (optional)
          </label>
          <Input
            value={customerPhone}
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit phone"
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, "").slice(0, 10);
              setCustomerPhone(value);
              void lookupPhone(value);
            }}
          />
          {lookupState === "found" && (
            <p className="mt-1 text-xs text-emerald-700">{customerName} · existing account</p>
          )}
          {lookupState === "new" && (
            <Input
              className="mt-2"
              value={customerName}
              placeholder="Name (optional)"
              onChange={(event) => setCustomerName(event.target.value)}
            />
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04]">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
            <span>
              {lines.length} {lines.length === 1 ? "item" : "items"}
            </span>
            <span>
              {totalUnits} {totalUnits === 1 ? "piece" : "pieces"}
            </span>
          </div>
          <Row label="Subtotal" value={formatPrice(subtotal)} />
          <Row label="Discount" value={discount > 0 ? `-${formatPrice(discount)}` : "—"} />
          <div className="mt-3 flex items-end justify-between border-t border-neutral-100 pt-3">
            <span className="text-sm font-semibold text-neutral-900">Total</span>
            <span className="text-3xl font-bold tabular-nums leading-none text-neutral-900">
              {formatPrice(total)}
            </span>
          </div>
          <p className="mt-1.5 text-right text-[11px] text-neutral-400">GST included</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11"
              disabled={lines.length === 0 || !mayDiscount}
              title={mayDiscount ? undefined : "A manager has to apply a discount"}
              onClick={() => setDiscountOpen(true)}
            >
              Discount
              <kbd className="ml-1 text-[10px] text-neutral-400">F4</kbd>
            </Button>
            <Button
              variant="outline"
              className="h-11"
              disabled={lines.length === 0}
              onClick={() => setClearConfirm(true)}
            >
              Clear
              <kbd className="ml-1 text-[10px] text-neutral-400">Esc</kbd>
            </Button>
          </div>

          <Button
            className="mt-2 h-14 w-full rounded-xl bg-stone-900 text-lg text-[#D4AF37] hover:bg-stone-800"
            disabled={lines.length === 0}
            onClick={() => setPayOpen(true)}
          >
            {lines.length === 0 ? "Pay" : `Pay ${formatPrice(total)}`}
            <kbd className="ml-2 text-[10px] opacity-70">F9</kbd>
          </Button>
        </div>

        {lastBill && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold text-emerald-900">Bill done · printed</span>
              <button
                type="button"
                aria-label="Dismiss last bill"
                onClick={() => setLastBill(null)}
                className="rounded p-0.5 text-emerald-700/60 hover:text-emerald-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="font-mono text-xs text-emerald-800">{lastBill.invoiceNumber}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-900">
              {formatPrice(lastBill.totalAmount)}
            </p>
            {lastBill.changeDue !== null && lastBill.changeDue > 0 && (
              <p className="mt-1 text-sm font-semibold text-emerald-800">
                Give change {formatPrice(lastBill.changeDue)}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => printReceipt(lastBill)}>
                Print again
              </Button>
              <a
                href={`/invoice/${lastBill.orderUuid}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                GST invoice
              </a>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={clearConfirm}
        onClose={() => {
          setClearConfirm(false);
          focusSku();
        }}
        onConfirm={() => {
          clearCart();
          setClearConfirm(false);
        }}
        title="Clear this bill?"
        description={`${lines.length} ${lines.length === 1 ? "item" : "items"} worth ${formatPrice(total)} will be removed. The customer's items will have to be scanned again.`}
        confirmText="Clear bill"
        variant="destructive"
      />

      {/* Mounted only while open, so each dialog starts from a clean slate
          without an effect resetting its fields on the way in. */}
      {discountOpen && (
        <DiscountDialog
          subtotal={subtotal}
          current={discount}
          maxPercent={store.maxCashierDiscountPercent}
          onClose={() => {
            setDiscountOpen(false);
            focusSku();
          }}
          onApply={(value) => {
            setDiscount(value);
            setDiscountOpen(false);
            focusSku();
          }}
        />
      )}

      {payOpen && (
        <PaymentDialog
          total={total}
          pending={createBill.isPending}
          onClose={() => {
            setPayOpen(false);
            focusSku();
          }}
          onPay={pay}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className="tabular-nums text-neutral-900">{value}</span>
    </div>
  );
}

/** Quantity step button, sized for a finger as well as a mouse. */
function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Hint({ keyName, children }: { keyName: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-neutral-500">
        {keyName}
      </kbd>
      {children}
    </span>
  );
}

function DiscountDialog({
  subtotal,
  current,
  maxPercent,
  onClose,
  onApply,
}: {
  subtotal: number;
  current: number;
  maxPercent: number;
  onClose: () => void;
  onApply: (value: number) => void;
}) {
  const [value, setValue] = useState(String(current || ""));

  const amount = Number(value) || 0;
  const cap = maxPercent > 0 ? round2((subtotal * maxPercent) / 100) : 0;
  const overCap = maxPercent > 0 && amount > cap;

  return (
    <Modal open onClose={onClose} title="Bill discount">
      <div className="space-y-4">
        <Input
          type="number"
          min={0}
          step="0.01"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !overCap) onApply(Math.min(amount, subtotal));
          }}
        />
        <p className="text-xs text-neutral-500">
          {maxPercent > 0
            ? `Up to ${maxPercent}% of ${formatPrice(subtotal)} — ${formatPrice(cap)}.`
            : "A discount needs a manager at this counter."}
        </p>
        {overCap && (
          <p className="text-xs text-red-600">Above the cap — a manager has to apply this.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-stone-900 text-[#D4AF37] hover:bg-stone-800"
            disabled={overCap}
            onClick={() => onApply(Math.min(amount, subtotal))}
          >
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Plausible notes for a bill: the next round hundred up, then the common
 * denominations above it. Anything at or below the bill is left out, since it
 * could not settle it.
 */
function cashSuggestions(total: number): number[] {
  const nextHundred = Math.ceil(total / 100) * 100;
  const candidates = [nextHundred, 500, 1000, 2000];
  return [...new Set(candidates)].filter((amount) => amount > total).sort((a, b) => a - b).slice(0, 4);
}

function PaymentDialog({
  total,
  pending,
  onClose,
  onPay,
}: {
  total: number;
  pending: boolean;
  onClose: () => void;
  onPay: (mode: PosPaymentMode, cashReceived?: number, reference?: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<PosPaymentMode>("CASH");
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");

  const receivedValue = Number(received) || 0;
  const change = round2(receivedValue - total);
  const cashShort = mode === "CASH" && received.trim() !== "" && receivedValue < total;
  const canPay = !pending && !cashShort;

  const submit = () => {
    if (!canPay) return;
    void onPay(
      mode,
      mode === "CASH" && received.trim() !== "" ? receivedValue : undefined,
      reference.trim() || undefined
    );
  };

  const modes: Array<{ value: PosPaymentMode; label: string; icon: typeof Banknote }> = [
    { value: "CASH", label: "Cash", icon: Banknote },
    { value: "UPI", label: "UPI", icon: Smartphone },
    { value: "CARD", label: "Card", icon: CreditCard },
  ];

  return (
    <Modal open onClose={onClose} title={`Take ${formatPrice(total)}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {modes.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium transition-colors",
                mode === option.value
                  ? "border-secondary-600 bg-secondary-50 text-secondary-700"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              )}
              aria-pressed={mode === option.value}
            >
              <option.icon className="h-5 w-5" />
              {option.label}
            </button>
          ))}
        </div>
        <p className="-mt-2 text-center text-[11px] text-neutral-400">
          Enter to confirm · Esc to go back
        </p>

        {mode === "CASH" ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Cash received
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              autoFocus
              value={received}
              className="h-12 text-lg font-semibold"
              onChange={(event) => setReceived(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submit()}
            />

            {/* The notes a customer actually hands over. Typing "2000" for a
                700 bill is the single most repeated keystroke at a till. */}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReceived(String(total))}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Exact
              </button>
              {cashSuggestions(total).map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setReceived(String(amount))}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium tabular-nums text-neutral-700 hover:bg-neutral-50"
                >
                  {amount}
                </button>
              ))}
            </div>

            {received.trim() !== "" && (
              <div
                className={cn(
                  "mt-3 rounded-xl p-3 text-center",
                  cashShort ? "bg-red-50" : change > 0 ? "bg-amber-50" : "bg-emerald-50"
                )}
              >
                <p
                  className={cn(
                    "text-xs",
                    cashShort ? "text-red-600" : change > 0 ? "text-amber-700" : "text-emerald-700"
                  )}
                >
                  {cashShort ? "Short by" : change > 0 ? "Give change" : "No change due"}
                </p>
                {(cashShort || change > 0) && (
                  <p
                    className={cn(
                      "text-2xl font-bold tabular-nums",
                      cashShort ? "text-red-700" : "text-amber-800"
                    )}
                  >
                    {formatPrice(cashShort ? total - receivedValue : change)}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              {mode === "UPI" ? "UPI reference (optional)" : "Card last 4 digits (optional)"}
            </label>
            <Input
              autoFocus
              maxLength={mode === "CARD" ? 4 : 60}
              inputMode={mode === "CARD" ? "numeric" : "text"}
              value={reference}
              onChange={(event) =>
                setReference(
                  mode === "CARD" ? event.target.value.replace(/\D/g, "").slice(0, 4) : event.target.value
                )
              }
              onKeyDown={(event) => event.key === "Enter" && submit()}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            className="h-12 flex-1 bg-stone-900 text-base text-[#D4AF37] hover:bg-stone-800"
            disabled={!canPay}
            onClick={submit}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Billing...
              </>
            ) : (
              "Confirm & print"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
