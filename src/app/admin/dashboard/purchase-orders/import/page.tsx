"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, TriangleAlert } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/Toast";
import { purchaseKeys } from "@/lib/api/query-keys";
import { confirmPurchase, previewPurchaseImport } from "@/features/purchases/api/purchases.api";
import { useVendors } from "@/features/purchases/hooks";
import type { PurchaseImportPreview } from "@/features/purchases/types";

const money = (n: number) => `₹${n.toFixed(2)}`;
const errMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const labelCls = "mb-1.5 block text-sm font-medium text-neutral-700";

export default function ImportPurchasesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [vendorId, setVendorId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [additionalCharges, setAdditionalCharges] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [preview, setPreview] = useState<PurchaseImportPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);

  const { data: vendorData } = useVendors({ page: 1, pageSize: 100 });
  const vendors = (vendorData?.data ?? []).filter((v) => v.isActive);
  const vendor = vendors.find((v) => v.id === vendorId);

  const invalidate = () => {
    setPreview(null);
  };

  const check = async () => {
    if (!vendorId) return toast.error("Select a vendor");
    if (!invoiceNumber.trim()) return toast.error("Enter the invoice number");
    if (!purchaseDate) return toast.error("Select the invoice date");
    if (!file) return toast.error("Choose the Excel file");
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

  const canImport = !!preview && preview.errors.length === 0 && !preview.alreadyImportedAs && preview.items.length > 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader
        title="Import Purchase"
        description="Pick the vendor, enter the invoice details and upload the Excel file. You review everything before any stock is added."
      />

      <div className="mt-6 max-w-5xl space-y-6">
        <div className="space-y-5 rounded-2xl bg-white p-6">
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
                <p className="mt-2 text-sm text-[var(--color-neutral-500)]">{vendor.address || "No address on file"}</p>
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
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="h-11 rounded-xl px-5">
              <FileUp className="mr-2 h-4 w-4" />
              {file ? file.name : "Choose Excel file (.xlsx)"}
            </Button>
            <Button onClick={check} disabled={checking || importing} className="h-11 rounded-xl px-5">
              {checking ? "Checking..." : "Check file"}
            </Button>
            <a
              href="/templates/purchase-import-sample.xlsx"
              download
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary-600)] hover:underline"
            >
              <Download className="h-4 w-4" />
              Download sample file
            </a>
          </div>
          <p className="text-sm text-[var(--color-neutral-500)]">
            Columns used: <b>Item Name</b> (must match the product SKU), <b>Qty</b> and <b>Rate+Tax</b> (stock cost).
            Other columns like Unit, Rate and Amount are ignored.
          </p>
        </div>

        {preview && (
          <div className="space-y-4 rounded-2xl bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {preview.vendor.name} · Invoice {preview.invoiceNumber}
                </p>
                <p className="text-sm text-[var(--color-neutral-500)]">
                  {preview.purchaseDate} · {preview.items.length} item(s) · subtotal {money(preview.subtotal)} + charges{" "}
                  {money(preview.additionalCharges)} = <span className="font-medium">{money(preview.total)}</span>
                </p>
              </div>
              <Button onClick={runImport} disabled={!canImport || importing} className="h-11 rounded-xl px-5">
                {importing ? "Importing..." : "Confirm and add stock"}
              </Button>
            </div>

            {preview.alreadyImportedAs && (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                This vendor invoice was already imported as {preview.alreadyImportedAs}. Stock will not be added again.
              </p>
            )}

            {preview.errors.length > 0 && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                <p className="mb-2 inline-flex items-center gap-1 font-medium">
                  <TriangleAlert className="h-4 w-4" /> Fix {preview.errors.length} error(s) in the file and check again.
                  Nothing is imported until every row is valid.
                </p>
                <ul className="space-y-1">
                  {preview.errors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.items.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-neutral-500)]">
                    <th className="py-1 font-medium">SKU</th>
                    <th className="py-1 font-medium">Product</th>
                    <th className="py-1 text-right font-medium">Qty</th>
                    <th className="py-1 text-right font-medium">Cost (Rate+Tax)</th>
                    <th className="py-1 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((i) => (
                    <tr key={i.sku}>
                      <td className="py-1">{i.sku}</td>
                      <td className="py-1">{i.productName}</td>
                      <td className="py-1 text-right">{i.quantity}</td>
                      <td className="py-1 text-right">{money(i.unitCost)}</td>
                      <td className="py-1 text-right">{money(i.quantity * i.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
