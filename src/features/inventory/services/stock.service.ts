import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import type { Prisma, stock_movement_type } from "@/generated/prisma";
import { getAdminInternalId } from "@/features/purchases/services/vendor.service";
import { recordStockMovement } from "./stock-ledger.service";
import { categoryFilterIds } from "./category-filter";
import { valuationService } from "./valuation.service";
import type {
  AdjustmentInput,
  StockListQuery,
  MovementListQuery,
} from "../validations/stock.schema";

export const LOW_STOCK_SETTING_KEY = "inventory.low_stock_threshold";
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/** How far back the dashboard's movement summary looks. */
const DASHBOARD_WINDOW_DAYS = 30;
/** How many reorder candidates and category rows the dashboard shows. */
const REORDER_LIST_SIZE = 8;
const TOP_CATEGORY_SIZE = 5;

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

/** Stock Movements shown per movement type on the dashboard/report chips. */
const stockLabelSelect = {
  id: true,
  sku: true,
  attribute_value: { select: { value: true } },
  variant: {
    select: {
      id: true,
      variant_name: true,
      color_name: true,
      item: {
        select: {
          id: true,
          name: true,
          style: { select: { product: { select: { id: true, name: true } } } },
        },
      },
    },
  },
} satisfies Prisma.VariantUnitPriceSelect;

type VupLabelRow = Prisma.VariantUnitPriceGetPayload<{ select: typeof stockLabelSelect }>;

function labelOf(vup: VupLabelRow) {
  const item = vup.variant?.item;
  return {
    variantUnitPriceId: Number(vup.id),
    productName: item?.style?.product?.name ?? item?.name ?? "Unknown product",
    itemName: item?.name ?? null,
    colorName: vup.variant?.color_name ?? null,
    sizeName: vup.attribute_value?.value ?? null,
    sku: vup.sku,
  };
}

/** Per-row reorder level wins when set, otherwise the store-wide threshold applies. */
function statusOf(available: number, reorderLevel: number, threshold: number): StockStatus {
  if (available <= 0) return "out_of_stock";
  const limit = reorderLevel > 0 ? reorderLevel : threshold;
  return available <= limit ? "low_stock" : "in_stock";
}

async function readThreshold(): Promise<number> {
  const row = await db.settings.findUnique({ where: { key_name: LOW_STOCK_SETTING_KEY } });
  const n = Number(row?.value);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_LOW_STOCK_THRESHOLD;
}

// A colour/size counts as our own stock only while everything above it is
// still live; a deleted product's rows would otherwise keep adding to the
// totals, and an item with no style resolves to no product at all.
const liveChain = {
  deleted_at: null,
  item: { deleted_at: null, style: { deleted_at: null, product: { deleted_at: null } } },
} satisfies Prisma.ProductVariantWhereInput;

const sellableVup: Prisma.VariantUnitPriceWhereInput = {
  isActive: true,
  deleted_at: null,
  variant: liveChain,
};

type StockRowLike = ReturnType<typeof labelOf> & {
  available: number;
  reserved: number;
  reorderLevel: number;
  threshold: number;
  status: StockStatus;
  updatedAt: string | null;
};

type MovementSummary = {
  movementType: stock_movement_type | null;
  movements: number;
  unitsIn: number;
  unitsOut: number;
};

export const stockService = {
  getThreshold: readThreshold,

  async setThreshold(value: number, adminEmail?: string | null) {
    const adminId = await getAdminInternalId(adminEmail);
    await db.settings.upsert({
      where: { key_name: LOW_STOCK_SETTING_KEY },
      create: {
        key_name: LOW_STOCK_SETTING_KEY,
        value: String(value),
        type: "number",
        created_by: adminId,
      },
      update: { value: String(value), updated_by: adminId },
    });
    return { lowStockThreshold: value };
  },

  async dashboard() {
    const threshold = await readThreshold();
    const since = new Date();
    since.setDate(since.getDate() - DASHBOARD_WINDOW_DAYS);

    const vupSelect = {
      ...stockLabelSelect,
      inventories: {
        select: {
          quantity_available: true,
          quantity_reserved: true,
          reorderLevel: true,
          updatedAt: true,
        },
      },
    } satisfies Prisma.VariantUnitPriceSelect;

    const [totalProducts, vups, recentPurchases, recentMovements, movementGroups, valuation] =
      await Promise.all([
        db.product.count({ where: { deleted_at: null, isActive: true } }),
        db.variantUnitPrice.findMany({ where: sellableVup, select: vupSelect }),
        db.purchase_orders.findMany({
          orderBy: { created_at: "desc" },
          take: 5,
          include: { vendor: { select: { name: true } }, _count: { select: { items: true } } },
        }),
        stockService.movements({ page: 1, limit: 8 }),
        db.inventoryTransaction.groupBy({
          by: ["movement_type", "type"],
          where: { is_active: true, createdAt: { gte: since } },
          _sum: { quantity: true },
          _count: { _all: true },
        }),
        // Money columns live in the valuation report, so the dashboard reads
        // them from there instead of working out costs a second way.
        valuationService.stockValuation({ groupBy: "category" }),
      ]);

    let totalStock = 0;
    let reservedStock = 0;
    let low = 0;
    let out = 0;
    const needsReorder: StockRowLike[] = [];

    for (const v of vups) {
      const qty = v.inventories?.quantity_available ?? 0;
      const reorderLevel = v.inventories?.reorderLevel ?? 0;
      const status = statusOf(qty, reorderLevel, threshold);
      totalStock += Math.max(0, qty);
      reservedStock += Math.max(0, v.inventories?.quantity_reserved ?? 0);
      if (status === "out_of_stock") out += 1;
      else if (status === "low_stock") low += 1;

      if (status !== "in_stock") {
        needsReorder.push({
          ...labelOf(v),
          available: qty,
          reserved: v.inventories?.quantity_reserved ?? 0,
          reorderLevel,
          threshold: reorderLevel > 0 ? reorderLevel : threshold,
          status,
          updatedAt: v.inventories?.updatedAt?.toISOString() ?? null,
        });
      }
    }

    // Emptiest first, so whatever is already sold out heads the list.
    needsReorder.sort(
      (a, b) =>
        a.available - b.available ||
        b.threshold - a.threshold ||
        a.productName.localeCompare(b.productName)
    );

    // Legacy rows carry no movement type; they are kept as their own line
    // rather than folded into one of the real types.
    const perType = new Map<string, MovementSummary>();
    for (const g of movementGroups) {
      const key = g.movement_type ?? "LEGACY";
      const row =
        perType.get(key) ?? { movementType: g.movement_type, movements: 0, unitsIn: 0, unitsOut: 0 };
      const units = g._sum.quantity ?? 0;
      row.movements += g._count._all;
      if (g.type === "out") row.unitsOut += units;
      else row.unitsIn += units;
      perType.set(key, row);
    }
    const movementSummary = [...perType.values()].sort(
      (a, b) => b.unitsIn + b.unitsOut - (a.unitsIn + a.unitsOut)
    );

    return {
      lowStockThreshold: threshold,
      windowDays: DASHBOARD_WINDOW_DAYS,
      totalProducts,
      totalVariants: vups.length,
      totalAvailableStock: totalStock,
      totalReservedStock: reservedStock,
      inStockItems: vups.length - low - out,
      lowStockItems: low,
      outOfStockItems: out,
      stockValue: {
        costValue: valuation.totals.costValue,
        retailValue: valuation.totals.retailValue,
        potentialProfit: valuation.totals.potentialProfit,
        marginPercent: valuation.totals.marginPercent,
        unvaluedSkus: valuation.totals.unvaluedSkus,
      },
      topCategories: valuation.rows.slice(0, TOP_CATEGORY_SIZE).map((r) => ({
        key: r.key,
        name: r.name,
        skuCount: r.skuCount,
        units: r.units,
        costValue: r.costValue,
        retailValue: r.retailValue,
      })),
      needsReorder: needsReorder.slice(0, REORDER_LIST_SIZE),
      reorderCount: needsReorder.length,
      movementSummary,
      recentPurchases: recentPurchases.map((p) => ({
        id: p.uuid,
        poNumber: p.po_number,
        vendorName: p.vendor.name,
        status: p.status,
        itemCount: p._count.items,
        totalAmount: Number(p.total_amount),
        purchaseDate: (p.purchase_date ?? p.created_at).toISOString(),
      })),
      recentMovements: recentMovements.data,
    };
  },

  /** Current stock, one row per product colour/size (a "variant" in inventory terms). */
  async currentStock(query: StockListQuery) {
    const { page, limit, search, status, color, categorySlug, productSlug, variantUnitPriceId } =
      query;
    const threshold = await readThreshold();

    // A category covers its sub-categories, and a product covers every colour
    // and size under it; both only narrow the rows when actually asked for,
    // on top of the live products the list is limited to anyway.
    const product: Prisma.ProductWhereInput = {
      deleted_at: null,
      ...(categorySlug ? { categoryId: { in: await categoryFilterIds(categorySlug) } } : {}),
      ...(productSlug ? { slug: productSlug } : {}),
    };

    const where: Prisma.VariantUnitPriceWhereInput = {
      ...sellableVup,
      ...(variantUnitPriceId ? { id: BigInt(variantUnitPriceId) } : {}),
      variant: {
        ...liveChain,
        ...(color ? { color_name: { contains: color } } : {}),
        item: { deleted_at: null, style: { deleted_at: null, product } },
      },
      ...(search
        ? {
            OR: [
              { sku: { contains: search } },
              { variant: { item: { name: { contains: search } } } },
              { variant: { item: { style: { product: { name: { contains: search } } } } } },
            ],
          }
        : {}),
    };

    const select = {
      ...stockLabelSelect,
      inventories: {
        select: { id: true, quantity_available: true, quantity_reserved: true, reorderLevel: true, updatedAt: true },
      },
    } satisfies Prisma.VariantUnitPriceSelect;

    const map = (v: Prisma.VariantUnitPriceGetPayload<{ select: typeof select }>) => {
      const available = v.inventories?.quantity_available ?? 0;
      const reorder = v.inventories?.reorderLevel ?? 0;
      return {
        ...labelOf(v),
        available,
        reserved: v.inventories?.quantity_reserved ?? 0,
        reorderLevel: reorder,
        threshold: reorder > 0 ? reorder : threshold,
        status: statusOf(available, reorder, threshold),
        updatedAt: v.inventories?.updatedAt?.toISOString() ?? null,
      };
    };

    const orderBy: Prisma.VariantUnitPriceOrderByWithRelationInput[] = [{ variant_id: "asc" }, { id: "asc" }];

    // Status compares two columns (stock vs. reorder level), which Prisma can't
    // express in a where clause, so status filtering is done in memory.
    if (status) {
      const all = (await db.variantUnitPrice.findMany({ where, select, orderBy })).map(map);
      const filtered = all.filter((r) => r.status === status);
      return {
        data: filtered.slice((page - 1) * limit, page * limit),
        meta: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
        threshold,
      };
    }

    const [rows, total] = await Promise.all([
      db.variantUnitPrice.findMany({ where, select, orderBy, skip: (page - 1) * limit, take: limit }),
      db.variantUnitPrice.count({ where }),
    ]);
    return {
      data: rows.map(map),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      threshold,
    };
  },

  async movements(query: MovementListQuery) {
    const { page, limit, type, search, variantUnitPriceId, from, to } = query;
    const where: Prisma.InventoryTransactionWhereInput = {
      is_active: true,
      ...(type ? { movement_type: type as stock_movement_type } : {}),
      ...(variantUnitPriceId ? { variant_unit_price_id: BigInt(variantUnitPriceId) } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { reference_number: { contains: search } },
              { note: { contains: search } },
              { variant_unit_price: { sku: { contains: search } } },
              {
                variant_unit_price: {
                  variant: { item: { style: { product: { name: { contains: search } } } } },
                },
              },
              { variant_unit_price: { variant: { item: { name: { contains: search } } } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.inventoryTransaction.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          variant_unit_price: { select: stockLabelSelect },
          users_inventory_transactions_created_byTousers: { select: { name: true } },
        },
      }),
      db.inventoryTransaction.count({ where }),
    ]);

    return {
      data: rows.map((t) => ({
        id: Number(t.id),
        ...labelOf(t.variant_unit_price),
        movementType: t.movement_type,
        direction: t.type,
        quantity: t.quantity,
        signedQuantity: t.type === "out" ? -t.quantity : t.quantity,
        previousStock: t.previous_stock,
        newStock: t.new_stock,
        referenceType: t.referenceType,
        referenceId: t.referenceId ? Number(t.referenceId) : null,
        referenceNumber: t.reference_number,
        reason: t.note,
        createdBy: t.users_inventory_transactions_created_byTousers?.name ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async adjust(input: AdjustmentInput, adminEmail?: string | null) {
    const adminId = await getAdminInternalId(adminEmail);
    const vup = await db.variantUnitPrice.findFirst({
      where: { id: BigInt(input.variantUnitPriceId), deleted_at: null },
      select: stockLabelSelect,
    });
    if (!vup) throw ApiError.notFound("Stock item not found");

    const result = await db.$transaction((tx) =>
      recordStockMovement(tx, {
        variantUnitPriceId: vup.id,
        movementType: "ADJUSTMENT",
        direction: input.direction,
        quantity: input.quantity,
        referenceType: "manual_adjustment",
        reason: input.reason,
        actorId: adminId,
        itemLabel: labelOf(vup).productName,
      })
    );

    return {
      ...labelOf(vup),
      previousStock: result.previousStock,
      newStock: result.newStock,
    };
  },
};
