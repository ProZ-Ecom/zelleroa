"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useVendors, usePurchaseProducts } from "../hooks";
import type { PurchaseOrderResponse, PurchaseProductOption } from "../types";

interface Line {
  variantUnitPriceId: number;
  label: string;
  productName: string;
  colorName: string | null;
  sizeName: string | null;
  sku: string;
  stock: number;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrderFormData {
  vendorId: string;
  expectedDate: string | null;
  purchaseDate: string | null;
  invoiceNumber: string;
  additionalCharges: number;
  notes: string;
  items: { variantUnitPriceId: number; quantity: number; unitCost: number }[];
}

interface Props {
  initial?: PurchaseOrderResponse | null;
  isLoading?: boolean;
  submitLabel: string;
  /** "confirm" records a finished purchase: no expected date, quantity is typed in, never guessed. */
  mode?: "draft" | "confirm";
  onSubmit: (data: PurchaseOrderFormData) => Promise<void>;
}

const labelCls = "mb-1.5 block text-sm font-medium text-neutral-700";

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function PurchaseOrderForm({ initial, isLoading, submitLabel, mode = "draft", onSubmit }: Props) {
  const [vendorId, setVendorId] = useState(initial?.vendor.id ?? "");
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDate ?? "");
  const [purchaseDate, setPurchaseDate] = useState(
    initial?.purchaseDate ?? new Date().toISOString().slice(0, 10)
  );
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? "");
  const [additionalCharges, setAdditionalCharges] = useState(initial?.additionalCharges ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial?.items?.map((i) => ({
      variantUnitPriceId: i.variantUnitPriceId,
      label: [i.productName, i.variantName, i.colorName, i.sizeName ?? i.unitName].filter(Boolean).join(" · "),
      productName: i.productName,
      colorName: i.colorName,
      sizeName: i.sizeName ?? i.unitName,
      sku: i.sku,
      stock: 0,
      quantity: i.quantityOrdered,
      unitCost: i.unitCost,
    })) ?? []
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: vendorData } = useVendors({ page: 1, pageSize: 100 });
  const debounced = useDebounced(search);
  const { data: options = [], isFetching } = usePurchaseProducts(debounced);

  const vendors = (vendorData?.data ?? []).filter((v) => v.isActive || v.id === initial?.vendor.id);
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const total = subtotal + (Number.isFinite(additionalCharges) ? additionalCharges : 0);

  const addLine = (o: PurchaseProductOption) => {
    setShowResults(false);
    setSearch("");
    setLines((prev) =>
      prev.some((l) => l.variantUnitPriceId === o.variantUnitPriceId)
        ? prev
        : [
            ...prev,
            {
              variantUnitPriceId: o.variantUnitPriceId,
              label: o.label,
              sku: o.sku,
              stock: o.stock,
              productName: o.productName,
              colorName: o.colorName,
              sizeName: o.sizeName,
              quantity: mode === "confirm" ? 0 : Math.max(1, o.reorderLevel - o.stock),
              unitCost: 0,
            },
          ]
    );
  };

  const patch = (id: number, p: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.variantUnitPriceId === id ? { ...l, ...p } : l)));

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!vendorId) return setError("Select a vendor");
        if (lines.length === 0) return setError("Add at least one item");
        if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1))
          return setError("Every quantity must be a whole number of at least 1");
        if (lines.some((l) => !(l.unitCost >= 0)))
          return setError("Purchase price cannot be negative");
        if (!(additionalCharges >= 0)) return setError("Additional charges cannot be negative");
        setError(null);
        await onSubmit({
          vendorId,
          expectedDate: expectedDate || null,
          purchaseDate: purchaseDate || null,
          invoiceNumber: invoiceNumber.trim(),
          additionalCharges,
          notes,
          items: lines.map((l) => ({
            variantUnitPriceId: l.variantUnitPriceId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        });
      }}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className={labelCls}>Vendor *</label>
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-secondary-600"
          >
            <option value="">Select vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Invoice number</label>
          <Input
            value={invoiceNumber}
            maxLength={60}
            placeholder="Vendor invoice no."
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Purchase date</label>
          <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>
        {mode === "draft" && (
          <div>
            <label className={labelCls}>Expected delivery</label>
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-neutral-700">Add item</label>
          <button
            type="button"
            onClick={() => {
              searchRef.current?.focus();
              setShowResults(true);
            }}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-600)] hover:underline"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            ref={searchRef}
            className="pl-9"
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
          />
          {showResults && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
              {options.length === 0 && (
                <p className="px-4 py-3 text-sm text-neutral-500">
                  {isFetching ? "Searching..." : "No products found"}
                </p>
              )}
              {options.map((o) => (
                <button
                  type="button"
                  key={o.variantUnitPriceId}
                  onClick={() => addLine(o)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-neutral-50"
                >
                  <span>
                    <span className="font-medium text-neutral-900">{o.label}</span>
                    <span className="ml-2 text-xs text-neutral-500">{o.sku}</span>
                  </span>
                  <span className={o.stock <= o.reorderLevel ? "text-xs text-error-600" : "text-xs text-neutral-500"}>
                    Stock {o.stock}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowResults(false)}
                className="w-full border-t border-neutral-100 px-4 py-2 text-xs text-neutral-500 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Color</th>
              <th className="px-4 py-2.5">Size</th>
              <th className="px-4 py-2.5 w-28">Qty</th>
              <th className="px-4 py-2.5 w-36">Purchase price (₹)</th>
              <th className="px-4 py-2.5 w-32 text-right">Line total</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                  No items yet. Search above to add products.
                </td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.variantUnitPriceId} className="border-t border-neutral-100">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-neutral-900">{l.productName}</p>
                  <p className="text-xs text-neutral-500">{l.sku}</p>
                </td>
                <td className="px-4 py-2.5">{l.colorName ?? "—"}</td>
                <td className="px-4 py-2.5">{l.sizeName ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={l.quantity || ""}
                    onChange={(e) => patch(l.variantUnitPriceId, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.unitCost}
                    onChange={(e) => patch(l.variantUnitPriceId, { unitCost: Number(e.target.value) })}
                  />
                </td>
                <td className="px-4 py-2.5 text-right font-medium">
                  ₹{(l.quantity * l.unitCost).toFixed(2)}
                </td>
                <td className="px-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setLines((p) => p.filter((x) => x.variantUnitPriceId !== l.variantUnitPriceId))}
                  >
                    <Trash2 className="h-4 w-4 text-[var(--color-error-600)]" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <td colSpan={5} className="px-4 py-2.5 text-right font-medium">
                  Subtotal
                </td>
                <td className="px-4 py-2.5 text-right font-medium">₹{subtotal.toFixed(2)}</td>
                <td />
              </tr>
              <tr className="bg-neutral-50">
                <td colSpan={5} className="px-4 py-2.5 text-right font-medium">
                  Additional charges (freight, packing…)
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={additionalCharges}
                    onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                  />
                </td>
                <td />
              </tr>
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <td colSpan={5} className="px-4 py-2.5 text-right font-semibold">
                  Total
                </td>
                <td className="px-4 py-2.5 text-right font-semibold">₹{total.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Button
          type="submit"
          isLoading={isLoading}
          className="h-11 rounded-xl bg-[var(--color-primary-500)] px-6 text-sm font-semibold text-white hover:bg-[var(--color-primary-600)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
