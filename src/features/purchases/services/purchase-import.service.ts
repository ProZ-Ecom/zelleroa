import crypto from "crypto";
import { readSheet } from "read-excel-file/node";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import type { PurchaseImportPreview } from "../types";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;
/** The sheet may carry title lines above the table; look this far down for the header. */
const HEADER_SEARCH_ROWS = 20;
/** A jump this big over the last paid cost is worth the admin looking at twice. */
const COST_JUMP_WARNING_PCT = 10;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Header names are compared without case or spaces, so "Rate + Tax" and "rate+tax" both match. */
const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/\s+/g, "");

/**
 * "Item Name" and "Rate+Tax" are the billing-software export this page accepted
 * before the stock sheet existed; files in that shape still import unchanged.
 */
const ALIASES = {
  sku: ["sku", "itemname", "item"],
  qty: ["qty", "quantity"],
  cost: ["purchaseprice", "rate+tax", "ratewithtax", "cost", "unitcost"],
  sell: ["sellingprice", "sellprice", "mrp"],
  damaged: ["damagedqty", "damagedquantity", "damaged"],
  remarks: ["remarks", "remark", "note", "notes"],
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

/** Blank cells come back as null; a cell the admin never touched is not an error. */
const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

export interface PurchaseImportParams {
  vendorId: string;
  invoiceNumber: string;
  purchaseDate: string;
  additionalCharges: number;
  notes: string | null;
}

async function readStockSheet(file: File): Promise<unknown[][]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  // The generated sheet names its table "Stock"; a hand-made file just has one sheet.
  try {
    return (await readSheet(buffer, "Stock")) as unknown[][];
  } catch {
    try {
      return (await readSheet(buffer)) as unknown[][];
    } catch {
      throw ApiError.badRequest("Could not read the Excel file. Save it as .xlsx and try again");
    }
  }
}

export const purchaseImportService = {
  /**
   * Reads a filled-in stock sheet for one vendor invoice and checks every row
   * against the database without changing anything: what arrived, what it cost,
   * any new selling price and anything damaged. The admin reviews the result
   * before confirming, and only then is stock touched.
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

    const sheet = await readStockSheet(file);

    const headerAt = sheet
      .slice(0, HEADER_SEARCH_ROWS)
      .findIndex((r) => findColumn(r, ALIASES.sku) >= 0 && findColumn(r, ALIASES.qty) >= 0);
    if (headerAt < 0) {
      throw ApiError.badRequest(
        'Could not find the header row. Download the stock sheet and fill that in - it needs at least a "SKU" and a "Qty" column'
      );
    }
    const header = sheet[headerAt];
    const col = {
      sku: findColumn(header, ALIASES.sku),
      qty: findColumn(header, ALIASES.qty),
      cost: findColumn(header, ALIASES.cost),
      sell: findColumn(header, ALIASES.sell),
      damaged: findColumn(header, ALIASES.damaged),
      remarks: findColumn(header, ALIASES.remarks),
    };
    if (col.cost < 0) {
      throw ApiError.badRequest('Column "Purchase Price" is missing');
    }

    const body = sheet.slice(headerAt + 1);
    if (body.length > MAX_ROWS) throw ApiError.badRequest(`Too many rows (max ${MAX_ROWS})`);

    // The sheet lists the whole selection, so most rows are untouched: a row is
    // part of this purchase only once a quantity is typed into it.
    const lines = body
      .map((r, i) => ({
        row: headerAt + i + 2,
        sku: String(r[col.sku] ?? "").trim(),
        qty: r[col.qty],
        cost: r[col.cost],
        sell: col.sell >= 0 ? r[col.sell] : null,
        damaged: col.damaged >= 0 ? r[col.damaged] : null,
        remarks: col.remarks >= 0 ? String(r[col.remarks] ?? "").trim() : "",
      }))
      .filter((l) => l.sku !== "" && !isBlank(l.qty));
    if (lines.length === 0) {
      throw ApiError.badRequest("No row has a quantity. Enter the quantity for each item that arrived");
    }

    const vups = await db.variantUnitPrice.findMany({
      where: { sku: { in: [...new Set(lines.map((l) => l.sku))] }, isActive: true, deleted_at: null },
      select: {
        id: true,
        sku: true,
        base_price: true,
        cost_price: true,
        inventories: { select: { quantity_available: true } },
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
    const warnings: string[] = [];
    const items: PurchaseImportPreview["items"] = [];
    const seen = new Set<string>();

    for (const l of lines) {
      const qty = Number(l.qty);
      if (!Number.isInteger(qty) || qty <= 0) {
        errors.push(`Row ${l.row} (${l.sku}): Qty must be a positive whole number`);
        continue;
      }
      if (isBlank(l.cost)) {
        errors.push(`Row ${l.row} (${l.sku}): Purchase Price is required when Qty is filled`);
        continue;
      }
      const cost = Number(l.cost);
      if (!Number.isFinite(cost) || cost < 0) {
        errors.push(`Row ${l.row} (${l.sku}): Purchase Price must be 0 or more`);
        continue;
      }

      const damaged = isBlank(l.damaged) ? 0 : Number(l.damaged);
      if (!Number.isInteger(damaged) || damaged < 0) {
        errors.push(`Row ${l.row} (${l.sku}): Damaged Qty must be a whole number`);
        continue;
      }
      if (damaged > qty) {
        errors.push(`Row ${l.row} (${l.sku}): Damaged Qty (${damaged}) is more than Qty (${qty})`);
        continue;
      }

      let sellingPrice: number | null = null;
      if (!isBlank(l.sell)) {
        const sell = Number(l.sell);
        if (!Number.isFinite(sell) || sell < 0) {
          errors.push(`Row ${l.row} (${l.sku}): Selling Price must be 0 or more`);
          continue;
        }
        sellingPrice = round2(sell);
      }

      const vup = vupBySku.get(l.sku.toLowerCase());
      if (!vup) {
        errors.push(
          `Row ${l.row}: no active item with SKU "${l.sku}". Create it in Catalog first, then download the sheet again`
        );
        continue;
      }
      if (seen.has(l.sku.toLowerCase())) {
        errors.push(`Row ${l.row}: "${l.sku}" appears more than once in this file`);
        continue;
      }
      seen.add(l.sku.toLowerCase());

      const item = vup.variant?.item;
      const productName =
        [item?.style?.product?.name ?? item?.name, vup.variant?.color_name, vup.attribute_value?.value]
          .filter(Boolean)
          .join(" / ") || vup.sku;

      const currentStock = vup.inventories?.quantity_available ?? 0;
      const lastCost = vup.cost_price === null ? null : Number(vup.cost_price);
      const currentSellingPrice = Number(vup.base_price);

      if (lastCost !== null && lastCost > 0) {
        const jump = ((cost - lastCost) / lastCost) * 100;
        if (Math.abs(jump) >= COST_JUMP_WARNING_PCT) {
          warnings.push(
            `Row ${l.row} (${l.sku}): cost ${jump > 0 ? "up" : "down"} ${Math.abs(Math.round(jump))}% on the last purchase (was ${lastCost.toFixed(2)}, now ${cost.toFixed(2)})`
          );
        }
      }

      items.push({
        row: l.row,
        sku: vup.sku,
        productName,
        variantUnitPriceId: Number(vup.id),
        quantity: qty,
        damagedQuantity: damaged,
        goodQuantity: qty - damaged,
        unitCost: round2(cost),
        lastCost,
        currentStock,
        newStock: currentStock + (qty - damaged),
        currentSellingPrice,
        sellingPrice: sellingPrice !== null && sellingPrice !== currentSellingPrice ? sellingPrice : null,
        remarks: l.remarks ? l.remarks.slice(0, 255) : null,
      });
    }

    const idempotencyKey = importKey(vendor.code, invoiceNumber);
    const existing = await db.purchase_orders.findUnique({
      where: { idempotency_key: idempotencyKey },
      select: { po_number: true },
    });

    // The vendor bills every unit delivered; the damaged ones come back as a
    // debit note, so they stay in the invoice total rather than being netted off.
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
      unitsReceived: items.reduce((s, i) => s + i.goodQuantity, 0),
      unitsDamaged: items.reduce((s, i) => s + i.damagedQuantity, 0),
      priceChanges: items.filter((i) => i.sellingPrice !== null).length,
      errors,
      warnings,
      alreadyImportedAs: existing?.po_number ?? null,
    };
  },
};
