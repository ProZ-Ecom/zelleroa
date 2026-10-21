import crypto from "crypto";
import { readSheet } from "read-excel-file/node";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import type { PurchaseImportPreview } from "../types";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 2000;
/** The billing export may have title lines above the table; look this far down for the header. */
const HEADER_SEARCH_ROWS = 20;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Header names are compared without case or spaces, so "Rate + Tax" and "rate+tax" both match. */
const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/\s+/g, "");

const ALIASES = {
  item: ["itemname", "item"],
  qty: ["qty", "quantity"],
  cost: ["rate+tax", "ratewithtax"],
} as const;

function findColumn(header: unknown[], names: readonly string[]) {
  return header.findIndex((h) => names.includes(norm(h)));
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Same vendor + invoice always yields the same key, so a re-upload can never add stock twice. */
function importKey(vendorCode: string, invoice: string) {
  const hash = crypto
    .createHash("sha256")
    .update(`${vendorCode.toLowerCase()}|${invoice.toLowerCase()}`)
    .digest("hex")
    .slice(0, 40);
  return `imp-${hash}`;
}

export interface PurchaseImportParams {
  vendorId: string;
  invoiceNumber: string;
  purchaseDate: string;
  additionalCharges: number;
  notes: string | null;
}

export const purchaseImportService = {
  /**
   * Reads an uploaded billing-software Excel file (Item Name, Qty, Rate+Tax)
   * for one vendor invoice and checks every line against the database without
   * changing anything. The admin reviews the result before confirming.
   */
  async preview(file: File, params: PurchaseImportParams): Promise<PurchaseImportPreview> {
    if (file.size === 0) throw ApiError.badRequest("The file is empty");
    if (file.size > MAX_BYTES) throw ApiError.badRequest("File is too large (max 2 MB)");
    if (!/\.xlsx$/i.test(file.name)) throw ApiError.badRequest("Upload an .xlsx Excel file");

    const invoiceNumber = params.invoiceNumber.trim();
    if (!invoiceNumber) throw ApiError.badRequest("Invoice number is required");
    if (invoiceNumber.length > 60) throw ApiError.badRequest("Invoice number is too long (max 60)");
    if (!isValidDate(params.purchaseDate)) throw ApiError.badRequest("Invoice date is required");

    const vendor = await db.vendors.findFirst({
      where: { uuid: params.vendorId, deleted_at: null },
      select: { uuid: true, code: true, name: true, address: true, is_active: true },
    });
    if (!vendor) throw ApiError.notFound("Vendor not found");
    if (!vendor.is_active) throw ApiError.badRequest("Vendor is inactive");

    let sheet: unknown[][];
    try {
      sheet = (await readSheet(Buffer.from(await file.arrayBuffer()))) as unknown[][];
    } catch {
      throw ApiError.badRequest("Could not read the Excel file. Save it as .xlsx and try again");
    }

    const headerAt = sheet
      .slice(0, HEADER_SEARCH_ROWS)
      .findIndex((r) => findColumn(r, ALIASES.item) >= 0 && findColumn(r, ALIASES.qty) >= 0);
    if (headerAt < 0) {
      throw ApiError.badRequest('Could not find the header row. Expected columns "Item Name", "Qty" and "Rate+Tax"');
    }
    const header = sheet[headerAt];
    const itemCol = findColumn(header, ALIASES.item);
    const qtyCol = findColumn(header, ALIASES.qty);
    const costCol = findColumn(header, ALIASES.cost);
    if (costCol < 0) throw ApiError.badRequest('Column "Rate+Tax" is missing');

    const body = sheet.slice(headerAt + 1);
    if (body.length > MAX_ROWS) throw ApiError.badRequest(`Too many rows (max ${MAX_ROWS})`);

    // Rows with no item name are the "Items 9 / total" footer, not products.
    const lines = body
      .map((r, i) => ({
        row: headerAt + i + 2,
        name: String(r[itemCol] ?? "").trim(),
        qty: r[qtyCol],
        cost: r[costCol],
      }))
      .filter((l) => l.name !== "");
    if (lines.length === 0) throw ApiError.badRequest("The file has no item rows");

    const vups = await db.variantUnitPrice.findMany({
      where: { sku: { in: [...new Set(lines.map((l) => l.name))] }, isActive: true, deleted_at: null },
      select: {
        id: true,
        sku: true,
        attribute_value: { select: { value: true } },
        variant: {
          select: {
            color_name: true,
            item: { select: { name: true, style: { select: { product: { select: { name: true } } } } } },
          },
        },
      },
    });
    const vupBySku = new Map(vups.map((v) => [v.sku.toLowerCase(), v]));

    const errors: string[] = [];
    const items: PurchaseImportPreview["items"] = [];
    const seen = new Set<number>();
    for (const l of lines) {
      const qty = Number(l.qty);
      const cost = Number(l.cost);
      if (l.qty === null || l.qty === undefined || !Number.isInteger(qty) || qty <= 0) {
        errors.push(`Row ${l.row} (${l.name}): Qty must be a positive whole number`);
        continue;
      }
      if (l.cost === null || l.cost === undefined || !Number.isFinite(cost) || cost < 0) {
        errors.push(`Row ${l.row} (${l.name}): Rate+Tax must be 0 or more`);
        continue;
      }
      const vup = vupBySku.get(l.name.toLowerCase());
      if (!vup) {
        errors.push(`Row ${l.row}: no product with SKU "${l.name}"`);
        continue;
      }
      if (seen.has(Number(vup.id))) {
        errors.push(`Row ${l.row}: "${l.name}" appears more than once in this file`);
        continue;
      }
      seen.add(Number(vup.id));
      const item = vup.variant?.item;
      const productName = [item?.style?.product?.name ?? item?.name, vup.variant?.color_name, vup.attribute_value?.value]
        .filter(Boolean)
        .join(" / ");
      items.push({
        row: l.row,
        sku: vup.sku,
        productName: productName || vup.sku,
        variantUnitPriceId: Number(vup.id),
        quantity: qty,
        unitCost: round2(cost),
      });
    }

    const idempotencyKey = importKey(vendor.code, invoiceNumber);
    const existing = await db.purchase_orders.findUnique({
      where: { idempotency_key: idempotencyKey },
      select: { po_number: true },
    });

    const subtotal = round2(items.reduce((s, i) => s + i.quantity * i.unitCost, 0));
    return {
      fileName: file.name,
      vendor: { id: vendor.uuid, code: vendor.code, name: vendor.name, address: vendor.address },
      invoiceNumber,
      purchaseDate: params.purchaseDate,
      additionalCharges: round2(params.additionalCharges),
      notes: params.notes,
      idempotencyKey,
      items,
      subtotal,
      total: round2(subtotal + params.additionalCharges),
      errors,
      alreadyImportedAs: existing?.po_number ?? null,
    };
  },
};
