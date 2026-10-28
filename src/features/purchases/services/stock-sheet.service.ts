import writeXlsxFile, { type Sheet } from "write-excel-file/node";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import type { Prisma } from "@/generated/prisma";
import type { StockSheetFilters } from "../validations/purchase.schema";

/** Beyond this the file stops being something an admin can work through by hand. */
const MAX_ROWS = 5000;

/**
 * Columns the admin fills in. Everything to the left of these is reference data
 * written by us and read back by SKU, so none of it has to be matched by name.
 */
export const ENTRY_COLUMNS = [
  "Qty",
  "Purchase Price",
  "Selling Price",
  "Damaged Qty",
  "Remarks",
] as const;

const FIXED_LEADING = ["SKU", "Product", "Item", "Colour"] as const;
const FIXED_TRAILING = ["Unit", "Current Stock", "Last Cost", "Current Selling Price"] as const;

const HEADER_FILL = "#E8EEF7";
/** The five columns the admin types into are tinted so they stand out. */
const ENTRY_FILL = "#FFF4CE";
const LOCKED_FONT = "#6B7280";

const rowSelect = {
  id: true,
  sku: true,
  base_price: true,
  cost_price: true,
  unit_value: true,
  product_units: { select: { name: true } },
  inventories: { select: { quantity_available: true } },
  attribute_value: { select: { value: true, attribute: { select: { name: true } } } },
  variant: {
    select: {
      color_name: true,
      variant_name: true,
      variant_attribute_values: {
        select: {
          attribute_values: { select: { value: true } },
          product_attributes: { select: { name: true } },
        },
      },
      item: {
        select: { name: true, style: { select: { product: { select: { name: true } } } } },
      },
    },
  },
} satisfies Prisma.VariantUnitPriceSelect;

type StockRow = Prisma.VariantUnitPriceGetPayload<{ select: typeof rowSelect }>;

/**
 * Every attribute carried by this SKU, by attribute name. The variant holds the
 * ones shared by the colour (Colour, Neck, Strap...); the unit price row holds
 * the one it was split on (normally Size), and that one wins where both name it.
 */
function attributesOf(row: StockRow): Map<string, string> {
  const out = new Map<string, string>();
  for (const v of row.variant?.variant_attribute_values ?? []) {
    if (v.product_attributes?.name && v.attribute_values?.value) {
      out.set(v.product_attributes.name, v.attribute_values.value);
    }
  }
  if (row.attribute_value?.attribute?.name && row.attribute_value.value) {
    out.set(row.attribute_value.attribute.name, row.attribute_value.value);
  }
  return out;
}

function productOf(row: StockRow) {
  return row.variant?.item?.style?.product?.name ?? row.variant?.item?.name ?? "";
}

/** Deepest sensible category nesting; the loop stops here rather than spinning on a cycle. */
const MAX_CATEGORY_DEPTH = 6;

/**
 * Products hang off a category by plain id, with no relation to filter through,
 * so the slug is resolved here - together with its sub-categories, because
 * picking "Men" should sheet everything under it, not just what sits directly on it.
 */
async function categoryIds(slug: string): Promise<bigint[]> {
  const root = await db.productCategory.findFirst({ where: { slug }, select: { id: true } });
  if (!root) throw ApiError.notFound("Category not found");

  const all = [root.id];
  let frontier = [root.id];
  for (let depth = 0; depth < MAX_CATEGORY_DEPTH && frontier.length > 0; depth++) {
    const children = await db.productCategory.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !all.includes(id));
    all.push(...frontier);
  }
  return all;
}

async function loadRows(filters: StockSheetFilters): Promise<StockRow[]> {
  const product: Prisma.ProductWhereInput = {
    deleted_at: null,
    ...(filters.productSlugs?.length ? { slug: { in: filters.productSlugs } } : {}),
    ...(filters.categorySlug ? { categoryId: { in: await categoryIds(filters.categorySlug) } } : {}),
    ...(filters.brandSlug ? { brand: { slug: filters.brandSlug } } : {}),
  };

  const where: Prisma.VariantUnitPriceWhereInput = {
    isActive: true,
    deleted_at: null,
    variant: {
      deleted_at: null,
      item: { deleted_at: null, style: { deleted_at: null, product } },
    },
    // Bought from this vendor before: narrows a long catalogue to what this
    // vendor actually supplies, which is usually what the admin wants to reorder.
    ...(filters.vendorId
      ? { purchase_order_items: { some: { purchase_order: { vendor: { uuid: filters.vendorId } } } } }
      : {}),
  };

  const rows = await db.variantUnitPrice.findMany({
    where,
    select: rowSelect,
    orderBy: [{ variant: { item: { name: "asc" } } }, { sku: "asc" }],
    take: MAX_ROWS + 1,
  });

  if (rows.length > MAX_ROWS) {
    throw ApiError.badRequest(
      `That selection has more than ${MAX_ROWS} items. Narrow it by category, brand or product.`
    );
  }
  if (!filters.lowStockOnly) return rows;

  // Reorder level is per stock row; a SKU with no stock row at all counts as empty.
  const levels = await db.inventory.findMany({
    where: { variantUnitPriceId: { in: rows.map((r) => r.id) } },
    select: { variantUnitPriceId: true, quantity_available: true, reorderLevel: true },
  });
  const byId = new Map(levels.map((l) => [l.variantUnitPriceId, l]));
  return rows.filter((r) => {
    const l = byId.get(r.id);
    return !l || l.quantity_available <= l.reorderLevel;
  });
}

const header = (text: string, entry: boolean) => ({
  value: text,
  fontWeight: "bold" as const,
  backgroundColor: entry ? ENTRY_FILL : HEADER_FILL,
  align: "center" as const,
  wrap: true,
});

/** Reference cells are greyed so it is obvious which columns are ours, not theirs. */
const locked = (value: string | number | null) =>
  value === null || value === "" ? null : { value, color: LOCKED_FONT };

/**
 * Builds the sheet an admin fills in to record a purchase: one row per SKU in
 * the selection, with its identity and current figures already filled, so the
 * only thing typed in is what arrived and what it cost. Reading it back needs
 * no name matching - the SKU column is written by us.
 */
export async function buildStockSheet(filters: StockSheetFilters): Promise<Buffer> {
  const rows = await loadRows(filters);
  if (rows.length === 0) {
    throw ApiError.badRequest("No items match that selection");
  }

  // One column per attribute anywhere in the selection, so products with
  // different attributes (Colour+Size here, Colour+Storage there) share a file;
  // a row simply leaves the columns that do not apply to it empty.
  const attributeNames = [
    ...new Set(rows.flatMap((r) => [...attributesOf(r).keys()])),
  ].filter((n) => n.toLowerCase() !== "colour" && n.toLowerCase() !== "color");
  attributeNames.sort();

  const columns = [...FIXED_LEADING, ...attributeNames, ...FIXED_TRAILING, ...ENTRY_COLUMNS];
  const firstEntryCol = columns.length - ENTRY_COLUMNS.length;

  const data: Sheet<Buffer>["data"] = [
    columns.map((c, i) => header(c, i >= firstEntryCol)),
    ...rows.map((r) => {
      const attrs = attributesOf(r);
      const colour = r.variant?.color_name ?? attrs.get("Colour") ?? attrs.get("Color") ?? null;
      return [
        { value: r.sku, fontWeight: "bold" as const },
        locked(productOf(r)),
        locked(r.variant?.item?.name ?? ""),
        locked(colour),
        ...attributeNames.map((n) => locked(attrs.get(n) ?? null)),
        locked(r.product_units?.name ?? ""),
        { value: r.inventories?.quantity_available ?? 0, type: Number, color: LOCKED_FONT },
        r.cost_price === null
          ? null
          : { value: Number(r.cost_price), type: Number, format: "#,##0.00", color: LOCKED_FONT },
        { value: Number(r.base_price), type: Number, format: "#,##0.00", color: LOCKED_FONT },
        // Left empty on purpose: these are the five the admin fills in. The
        // type and format are set so what they type lands as a number.
        { type: Number },
        { type: Number, format: "#,##0.00" },
        { type: Number, format: "#,##0.00" },
        { type: Number },
        { type: String },
      ];
    }),
  ];

  const instructions: Sheet<Buffer>["data"] = [
    [{ value: "How to fill this sheet", fontWeight: "bold", fontSize: 14 }],
    [{ value: "" }],
    ...[
      "1. Fill Qty only for the items that arrived. Leave Qty empty and the row is ignored.",
      "2. Purchase Price is the per-unit cost you were billed, including tax.",
      "3. Selling Price changes the price shown to customers. Leave it empty to keep the current price.",
      "4. Damaged Qty is how many of the Qty arrived unusable. Those units are not added to stock and a purchase return is drafted for them.",
      "5. Do not edit the SKU column or any grey column - they are how the file is read back.",
      "6. Do not add rows for items that are not in the catalogue. Create them in Catalog first, then download this sheet again.",
      "7. Save as .xlsx and upload it on the Import Purchase page.",
    ].map((t) => [{ value: t, wrap: true } as const]),
  ];

  const sheets: Sheet<Buffer>[] = [
    {
      sheet: "Stock",
      data,
      stickyRowsCount: 1,
      stickyColumnsCount: 1,
      columns: columns.map((c) => ({ width: c === "Remarks" ? 28 : Math.max(12, c.length + 4) })),
    },
    { sheet: "Instructions", data: instructions, columns: [{ width: 110 }] },
  ];

  return writeXlsxFile(sheets).toBuffer();
}

/** Safe-for-headers file name, e.g. Zellora-stock-sheet-ACME-2026-10-26.xlsx. */
export function stockSheetFileName(vendorCode: string | null) {
  const date = new Date().toISOString().slice(0, 10);
  const vendor = (vendorCode ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20);
  return `Zellora-stock-sheet${vendor ? `-${vendor}` : ""}-${date}.xlsx`;
}
