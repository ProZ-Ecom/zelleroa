"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Download, FileUp, Info, TriangleAlert } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/Toast";
import { purchaseKeys } from "@/lib/api/query-keys";
import { useBrands } from "@/features/brands/hooks";
import { useCategories } from "@/features/categories/hooks";
import {
  confirmPurchase,
  downloadStockSheet,
  previewPurchaseImport,
} from "@/features/purchases/api/purchases.api";
import { useVendors } from "@/features/purchases/hooks";
import type { PurchaseImportPreview } from "@/features/purchases/types";

const money = (n: number) => `₹${n.toFixed(2)}`;
const errMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const labelCls = "mb-1.5 block text-sm font-medium text-neutral-700";
const cardCls = "space-y-5 rounded-2xl bg-white p-6";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const toneCls =
    tone === "bad"
      ? "text-red-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "good"
          ? "text-emerald-600"
          : "text-[var(--color-neutral-900)]";
  return (
    <div className="rounded-xl bg-[var(--color-neutral-50)] px-4 py-3">
      <p className="text-xs text-[var(--color-neutral-500)]">{label}</p>
      <p className={`text-lg font-semibold ${toneCls}`}>{value}</p>
    </div>
  );
}

export default function ImportPurchasesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [vendorId, setVendorId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [additionalCharges, setAdditionalCharges] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [categorySlug, setCategorySlug] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [vendorItemsOnly, setVendorItemsOnly] = useState(false);

  const [preview, setPreview] = useState<PurchaseImportPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: vendorData } = useVendors({ page: 1, pageSize: 100 });
  const vendors = (vendorData?.data ?? []).filter((v) => v.isActive);
  const vendor = vendors.find((v) => v.id === vendorId);

  const { data: categoryData } = useCategories({ page: 1, pageSize: 200 });
  const categories = categoryData?.data ?? [];
  // 100 is the most /api/brands will return in one page.
  const { data: brandData } = useBrands({ page: 1, limit: 100 });
  const brands = brandData?.data ?? [];

  const invalidate = () => setPreview(null);

  const download = async () => {
    setDownloading(true);
    try {
      const name = await downloadStockSheet({
        vendorId: vendorItemsOnly && vendorId ? vendorId : undefined,
        categorySlug: categorySlug || undefined,
        brandSlug: brandSlug || undefined,
        lowStockOnly,
      });
      toast.success(`Downloaded ${name}`);
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  const check = async () => {
    if (!vendorId) return toast.error("Select a vendor");
    if (!invoiceNumber.trim()) return toast.error("Enter the invoice number");
    if (!purchaseDate) return toast.error("Select the invoice date");
    if (!file) return toast.error("Choose the filled stock sheet");
    setChecking(true);
    setPreview(null);
    try {
      setPreview(
        await previewPurchaseImport(file, {
          vendorId,
          invoiceNumber,
          purchaseDate,
          additionalCharges,
          notes: "",
        })
      );
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setChecking(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await confirmPurchase({
        vendorId: preview.vendor.id,
        purchaseDate: preview.purchaseDate,
        invoiceNumber: preview.invoiceNumber,
        additionalCharges: preview.additionalCharges,
        notes: preview.notes,
        idempotencyKey: preview.idempotencyKey,
        items: preview.items.map((i) => ({
          variantUnitPriceId: i.variantUnitPriceId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          damagedQuantity: i.damagedQuantity,
          sellingPrice: i.sellingPrice,
          remarks: i.remarks,
        })),
      });
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Purchase imported, stock updated");
      router.push(`/admin/dashboard/purchase-orders/${res.data?.id ?? ""}`);
    } catch (e) {
      toast.error(errMessage(e));
      setImporting(false);
    }
  };

  const canImport =
    !!preview && preview.errors.length === 0 && !preview.alreadyImportedAs && preview.items.length > 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader
        title="Import Purchase"
        description="Download the stock sheet, fill in what arrived, and upload it back. You review everything before any stock is added."
      />

      <div className="mt-6 max-w-6xl space-y-6">
        <div className={cardCls}>
          <p className="text-sm font-semibold text-[var(--color-neutral-900)]">1. Purchase details</p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={labelCls}>Vendor *</label>
              <Select
                value={vendorId}
                onValueChange={(val) => {
                  setVendorId(val);
                  invalidate();
                }}
                options={vendors.map((v) => ({ value: v.id, label: `${v.name} (${v.code})` }))}
                placeholder="Select vendor"
                searchable={vendors.length > 5}
                className="w-full"
              />
              {vendor && (
                <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
                  {vendor.address || "No address on file"}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Invoice number *</label>
              <Input
                value={invoiceNumber}
                maxLength={60}
                placeholder="e.g. 100099"
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  invalidate();
                }}
              />
            </div>
            <div>
              <label className={labelCls}>Invoice date *</label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => {
                  setPurchaseDate(e.target.value);
                  invalidate();
                }}
              />
            </div>
            <div>
              <label className={labelCls}>Additional charges</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={additionalCharges}
                placeholder="Freight, packing (optional)"
                onChange={(e) => {
                  setAdditionalCharges(e.target.value);
                  invalidate();
                }}
              />
            </div>
          </div>
        </div>

        <div className={cardCls}>
          <div>
            <p className="text-sm font-semibold text-[var(--color-neutral-900)]">2. Download the stock sheet</p>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              Every item you pick comes out as a row with its SKU, colour, size and current figures already filled
              in. You only type the quantity, the price and anything damaged.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={labelCls}>Category</label>
              <Select
                value={categorySlug}
                onValueChange={setCategorySlug}
                options={[
                  { value: "", label: "All categories" },
                  ...categories.map((c) => ({ value: c.slug, label: c.name })),
                ]}
                placeholder="All categories"
                searchable={categories.length > 5}
                className="w-full"
              />
            </div>
            <div>
              <label className={labelCls}>Brand</label>
              <Select
                value={brandSlug}
                onValueChange={setBrandSlug}
                options={[
                  { value: "", label: "All brands" },
                  ...brands.map((b) => ({ value: b.slug, label: b.name })),
                ]}
                placeholder="All brands"
                searchable={brands.length > 5}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Checkbox
              label="Only items at or below their reorder level"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            <Checkbox
              label="Only items bought from this vendor before"
              checked={vendorItemsOnly}
              disabled={!vendorId}
              onChange={(e) => setVendorItemsOnly(e.target.checked)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={download}
            disabled={downloading}
            className="h-11 rounded-xl px-5"
          >
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Preparing..." : "Download stock sheet"}
          </Button>
        </div>

        <div className={cardCls}>
          <p className="text-sm font-semibold text-[var(--color-neutral-900)]">3. Upload the filled sheet</p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                invalidate();
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="h-11 rounded-xl px-5"
            >
              <FileUp className="mr-2 h-4 w-4" />
              {file ? file.name : "Choose file (.xlsx)"}
            </Button>
            <Button onClick={check} disabled={checking || importing} className="h-11 rounded-xl px-5">
              {checking ? "Checking..." : "Check file"}
            </Button>
          </div>
          <p className="text-sm text-[var(--color-neutral-500)]">
            Rows with an empty <b>Qty</b> are skipped. <b>Selling Price</b> left empty keeps the current price.{" "}
            <b>Damaged Qty</b> units are not added to stock and are drafted as a purchase return.
          </p>
        </div>

        {preview && (
          <div className="space-y-5 rounded-2xl bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {preview.vendor.name} · Invoice {preview.invoiceNumber}
                </p>
                <p className="text-sm text-[var(--color-neutral-500)]">
                  {preview.purchaseDate} · {preview.fileName}
                </p>
              </div>
              <Button onClick={runImport} disabled={!canImport || importing} className="h-11 rounded-xl px-5">
                {importing ? "Importing..." : "Confirm and add stock"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Items" value={String(preview.items.length)} />
              <Stat label="Units to stock" value={String(preview.unitsReceived)} tone="good" />
              <Stat
                label="Damaged"
                value={String(preview.unitsDamaged)}
                tone={preview.unitsDamaged > 0 ? "warn" : undefined}
              />
              <Stat label="Price changes" value={String(preview.priceChanges)} />
              <Stat label="Invoice total" value={money(preview.total)} />
            </div>

            {preview.alreadyImportedAs && (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                This vendor invoice was already imported as {preview.alreadyImportedAs}. Stock will not be added
                again.
              </p>
            )}

            {preview.errors.length > 0 && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                <p className="mb-2 inline-flex items-center gap-1 font-medium">
                  <TriangleAlert className="h-4 w-4" /> Fix {preview.errors.length} error(s) and check again. Nothing
                  is imported until every row is valid.
                </p>
                <ul className="space-y-1">
                  {preview.errors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.warnings.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                <p className="mb-2 inline-flex items-center gap-1 font-medium">
                  <Info className="h-4 w-4" /> Worth a look, but you can still import.
                </p>
                <ul className="space-y-1">
                  {preview.warnings.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[var(--color-neutral-500)]">
                      <th className="py-2 font-medium">SKU</th>
                      <th className="py-2 font-medium">Product</th>
                      <th className="py-2 text-right font-medium">Qty</th>
                      <th className="py-2 text-right font-medium">Damaged</th>
                      <th className="py-2 text-right font-medium">Stock</th>
                      <th className="py-2 text-right font-medium">Cost</th>
                      <th className="py-2 text-right font-medium">Selling price</th>
                      <th className="py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((i) => (
                      <tr key={i.sku} className="border-b last:border-0">
                        <td className="py-2 font-medium">{i.sku}</td>
                        <td className="py-2">{i.productName}</td>
                        <td className="py-2 text-right">{i.quantity}</td>
                        <td className={`py-2 text-right ${i.damagedQuantity > 0 ? "text-amber-600" : ""}`}>
                          {i.damagedQuantity || "—"}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <span className="text-[var(--color-neutral-500)]">{i.currentStock}</span>
                          <ArrowRight className="mx-1 inline h-3 w-3 text-[var(--color-neutral-400)]" />
                          <span className="font-medium">{i.newStock}</span>
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          {money(i.unitCost)}
                          {i.lastCost !== null && i.lastCost !== i.unitCost && (
                            <span className="ml-1 text-xs text-[var(--color-neutral-500)]">
                              (was {money(i.lastCost)})
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          {i.sellingPrice === null ? (
                            <span className="text-[var(--color-neutral-500)]">{money(i.currentSellingPrice)}</span>
                          ) : (
                            <>
                              <span className="text-[var(--color-neutral-500)] line-through">
                                {money(i.currentSellingPrice)}
                              </span>
                              <span className="ml-1 font-medium text-emerald-600">{money(i.sellingPrice)}</span>
                            </>
                          )}
                        </td>
                        <td className="py-2 text-right">{money(i.quantity * i.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7} className="py-2 text-right text-[var(--color-neutral-500)]">
                        Subtotal
                      </td>
                      <td className="py-2 text-right">{money(preview.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="py-1 text-right text-[var(--color-neutral-500)]">
                        Additional charges
                      </td>
                      <td className="py-1 text-right">{money(preview.additionalCharges)}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="py-1 text-right font-medium">
                        Total
                      </td>
                      <td className="py-1 text-right font-semibold">{money(preview.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
