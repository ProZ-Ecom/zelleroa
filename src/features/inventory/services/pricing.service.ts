import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import type { Prisma } from "@/generated/prisma";
import { getAdminInternalId } from "@/features/purchases/services/vendor.service";
import { productName } from "@/features/purchases/services/purchase-item.select";
import type { PricingListParams, PricingRow, PricingSummary } from "../types/pricing";
import type { ApplyPricingInput, PricingListQuery } from "../validations/pricing.schema";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Deepest sensible category nesting; the loop stops here rather than spinning on a cycle. */
const MAX_CATEGORY_DEPTH = 6;

const rowSelect = {
  id: true,
  uuid: true,
  sku: true,
  base_price: true,
  cost_price: true,
  avg_cost: true,
  isActive: true,
  updatedAt: true,
  product_units: { select: { name: true } },
  inventories: { select: { quantity_available: true } },
  variant: {
    select: {
      variant_name: true,
      color_name: true,
      item: { select: { name: true, style: { select: { product: { select: { name: true } } } } } },
    },
  },
  attribute_value: { select: { value: true } },
} satisfies Prisma.VariantUnitPriceSelect;

type Row = Prisma.VariantUnitPriceGetPayload<{ select: typeof rowSelect }>;

/**
 * Products hang off a category by plain id, with no relation to filter
 * through, so the slug is resolved here together with its sub-categories.
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

/** Profit as a share of the selling price, which is how retail margin is read. */
function marginOf(sellingPrice: number, cost: number | null) {
  if (cost === null || sellingPrice <= 0) return null;
  return round2(((sellingPrice - cost) / sellingPrice) * 100);
}

function format(r: Row): PricingRow {
  const sellingPrice = Number(r.base_price);
  const costPrice = r.cost_price === null ? null : Number(r.cost_price);
  const avgCost = r.avg_cost === null ? null : Number(r.avg_cost);
  const stock = r.inventories?.quantity_available ?? 0;
  return {
    id: r.uuid,
    variantUnitPriceId: Number(r.id),
    sku: r.sku,
    productName: productName(r),
    itemName: r.variant?.item?.name ?? null,
    colorName: r.variant?.color_name ?? null,
    sizeName: r.attribute_value?.value ?? null,
    unitName: r.product_units?.name ?? null,
    sellingPrice,
    costPrice,
    avgCost,
    marginPercent: marginOf(sellingPrice, avgCost ?? costPrice),
    stock,
    stockValue: avgCost === null ? null : round2(avgCost * stock),
    isActive: r.isActive,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

async function buildWhere(params: PricingListParams): Promise<Prisma.VariantUnitPriceWhereInput> {
  const product: Prisma.ProductWhereInput = {
    deleted_at: null,
    ...(params.categorySlug ? { categoryId: { in: await categoryIds(params.categorySlug) } } : {}),
    ...(params.brandSlug ? { brand: { slug: params.brandSlug } } : {}),
  };

  return {
    deleted_at: null,
    variant: { deleted_at: null, item: { deleted_at: null, style: { deleted_at: null, product } } },
    ...(params.search
      ? {
          OR: [
            { sku: { contains: params.search } },
            { variant: { item: { name: { contains: params.search } } } },
            { variant: { item: { style: { product: { name: { contains: params.search } } } } } },
          ],
        }
      : {}),
    ...(params.unpriced ? { base_price: { lte: 0 } } : {}),
  };
}

export const pricingService = {
  /**
   * Cost, selling price and margin per SKU - the one screen where prices are
   * entered, now that the catalog only describes what a product is.
   */
  async list(params: PricingListQuery) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const where = await buildWhere(params);

    // "At or below cost" compares two columns, which Prisma cannot express in
    // a filter, so it is applied after loading rather than in the query.
    if (params.belowCost) {
      const rows = await db.variantUnitPrice.findMany({
        where: { ...where, cost_price: { not: null } },
        select: rowSelect,
        orderBy: { sku: "asc" },
        take: 2000,
      });
      const matching = rows.filter((r) => Number(r.base_price) <= Number(r.cost_price));
      return {
        data: matching.slice((page - 1) * pageSize, page * pageSize).map(format),
        meta: {
          page,
          limit: pageSize,
          pageSize,
          total: matching.length,
          totalPages: Math.max(1, Math.ceil(matching.length / pageSize)),
        },
      };
    }

    const [rows, total] = await Promise.all([
      db.variantUnitPrice.findMany({
        where,
        select: rowSelect,
        orderBy: { sku: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.variantUnitPrice.count({ where }),
    ]);
    return {
      data: rows.map(format),
      meta: { page, limit: pageSize, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  /**
   * Writes new selling prices, each with a price-history entry so no change is
   * silent. A row whose price works out the same is left alone rather than
   * filling the history with no-ops.
   */
  async apply(input: ApplyPricingInput, adminEmail?: string | null): Promise<PricingSummary> {
    const adminId = await getAdminInternalId(adminEmail);
    const uuids = input.mode === "manual" ? input.prices.map((p) => p.id) : input.ids;

    const rows = await db.variantUnitPrice.findMany({
      where: { uuid: { in: uuids }, deleted_at: null },
      select: { id: true, uuid: true, sku: true, base_price: true, cost_price: true, avg_cost: true },
    });
    if (rows.length === 0) throw ApiError.badRequest("None of the selected items were found");

    const requested = input.mode === "manual" ? new Map(input.prices.map((p) => [p.id, p.sellingPrice])) : null;
    const skipped: PricingSummary["skipped"] = [];
    const updates: { id: bigint; oldPrice: number; newPrice: number }[] = [];

    for (const row of rows) {
      const oldPrice = Number(row.base_price);
      // Last paid cost is what a markup should price off, not the blended average.
      const cost = row.cost_price === null ? null : Number(row.cost_price);
      let next: number;

      switch (input.mode) {
        case "manual":
          next = requested!.get(row.uuid)!;
          break;
        case "set":
          next = input.value;
          break;
        case "percent":
          next = oldPrice * (1 + input.value / 100);
          break;
        case "amount":
          next = oldPrice + input.value;
          break;
        case "markup":
          if (cost === null) {
            skipped.push({ sku: row.sku, reason: "no purchase cost recorded yet" });
            continue;
          }
          next = cost * (1 + input.value / 100);
          break;
      }

      if (input.mode !== "manual" && input.rounding === "rupee") next = Math.round(next);
      next = round2(next);

      if (next < 0) {
        skipped.push({ sku: row.sku, reason: "that change would make the price negative" });
        continue;
      }
      if (next === oldPrice) {
        skipped.push({ sku: row.sku, reason: "price unchanged" });
        continue;
      }
      updates.push({ id: row.id, oldPrice, newPrice: next });
    }

    if (updates.length > 0) {
      await db.$transaction(async (tx) => {
        for (const u of updates) {
          await tx.variantUnitPrice.update({
            where: { id: u.id },
            data: { base_price: u.newPrice, updated_by: adminId },
          });
          await tx.variant_price_history.create({
            data: {
              uuid: crypto.randomUUID(),
              variant_unit_price_id: u.id,
              old_base_price: u.oldPrice,
              new_base_price: u.newPrice,
              created_by: adminId,
              updated_by: adminId,
            },
          });
        }
      });
    }

    return { updated: updates.length, skipped };
  },
};
