import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import { SOLD_ORDER, inRange, num, ratio, resolveRange, round2 } from "../lib/report-range";
import { resolveBrandFilter, resolveCategoryFilter } from "../lib/report-filters";

export interface ProductsFilters {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  brand?: string;
}

export interface ProductsTotals {
  skusSold: number;
  units: number;
  revenue: number;
  /** Revenue on the subset of lines that recorded a unit cost. */
  costedRevenue: number;
  cost: number;
  margin: number;
  marginPercent: number | null;
  /** Share of revenue that has a cost behind it, so a thin margin can be read honestly. */
  costCoverage: number;
  returnedUnits: number;
  returnRate: number;
  zeroSaleSkus: number;
}

export interface SkuRow {
  key: string;
  sku: string;
  product: string;
  variant: string;
  category: string;
  brand: string;
  units: number;
  revenue: number;
  orders: number;
  /** Null when no line for this SKU carried a unit cost. */
  cost: number | null;
  margin: number | null;
  marginPercent: number | null;
  returnedUnits: number;
  stock: number;
}

export interface GroupRow {
  key: string;
  label: string;
  skus: number;
  units: number;
  revenue: number;
  share: number;
}

export interface ProductsReport {
  range: { from: string; to: string; days: number };
  totals: ProductsTotals;
  skus: SkuRow[];
  skusTruncated: boolean;
  byCategory: GroupRow[];
  byBrand: GroupRow[];
  bestSellers: SkuRow[];
  slowMovers: SkuRow[];
  zeroSale: SkuRow[];
  zeroSaleTruncated: boolean;
}

const SKU_LIMIT = 1000;
const ZERO_SALE_LIMIT = 100;

export const productsReportService = {
  async summary(filters: ProductsFilters): Promise<ProductsReport> {
    const range = resolveRange(filters);
    const [categoryId, brandId] = await Promise.all([
      resolveCategoryFilter(filters.category),
      resolveBrandFilter(filters.brand),
    ]);

    const productWhere: Prisma.ProductWhereInput = {
      ...(categoryId !== null ? { categoryId } : {}),
      ...(brandId !== null ? { brandId } : {}),
    };
    const hasProductFilter = categoryId !== null || brandId !== null;

    const items = await db.orderItem.findMany({
      where: {
        is_active: true,
        order: { ...SOLD_ORDER, createdAt: inRange(range) },
        ...(hasProductFilter ? { product: productWhere } : {}),
      },
      select: {
        orderId: true,
        productId: true,
        variantUnitPriceId: true,
        product_name_snapshot: true,
        variant_snapshot: true,
        sku_snapshot: true,
        quantity: true,
        unit_price: true,
        unit_cost: true,
        total_price: true,
        tax_amount: true,
        product: { select: { categoryId: true, brandId: true, brand: { select: { name: true } } } },
      },
    });

    type Acc = {
      sku: string;
      product: string;
      variant: string;
      categoryId: string | null;
      brand: string;
      units: number;
      revenue: number;
      orders: Set<string>;
      costedUnits: number;
      cost: number;
      costedRevenue: number;
      vupId: string | null;
    };

    const bySku = new Map<string, Acc>();
    for (const item of items) {
      const key = item.variantUnitPriceId ? `v${item.variantUnitPriceId}` : `s${item.sku_snapshot}`;
      const row =
        bySku.get(key) ??
        ({
          sku: item.sku_snapshot,
          product: item.product_name_snapshot,
          variant: item.variant_snapshot,
          categoryId: item.product?.categoryId != null ? String(item.product.categoryId) : null,
          brand: item.product?.brand?.name ?? "No brand",
          units: 0,
          revenue: 0,
          orders: new Set<string>(),
          costedUnits: 0,
          cost: 0,
          costedRevenue: 0,
          vupId: item.variantUnitPriceId ? String(item.variantUnitPriceId) : null,
        } satisfies Acc);

      row.units += item.quantity;
      row.revenue = round2(row.revenue + num(item.total_price));
      row.orders.add(String(item.orderId));
      if (item.unit_cost != null) {
        row.costedUnits += item.quantity;
        row.cost = round2(row.cost + num(item.unit_cost) * item.quantity);
        row.costedRevenue = round2(row.costedRevenue + num(item.total_price));
      }
      bySku.set(key, row);
    }

    const vupIds = [...bySku.values()]
      .map((r) => r.vupId)
      .filter((id): id is string => id != null)
      .map((id) => BigInt(id));

    const [categoryNames, stockRows, returnRows] = await Promise.all([
      categoryNameMap([...bySku.values()].map((r) => r.categoryId)),
      vupIds.length
        ? db.inventory.findMany({
            where: { variantUnitPriceId: { in: vupIds } },
            select: { variantUnitPriceId: true, quantity_available: true },
          })
        : Promise.resolve([]),
      returnedUnitsBySku(range),
    ]);

    const stockByVup = new Map(stockRows.map((s) => [String(s.variantUnitPriceId), s.quantity_available]));

    const skus: SkuRow[] = [...bySku.entries()].map(([key, r]) => {
      const cost = r.costedUnits ? r.cost : null;
      const margin = cost == null ? null : round2(r.costedRevenue - cost);
      return {
        key,
        sku: r.sku,
        product: r.product,
        variant: r.variant,
        category: (r.categoryId ? categoryNames.get(r.categoryId) : null) ?? "Uncategorised",
        brand: r.brand,
        units: r.units,
        revenue: r.revenue,
        orders: r.orders.size,
        cost,
        margin,
        marginPercent: margin != null && r.costedRevenue ? Math.round((margin / r.costedRevenue) * 1000) / 10 : null,
        returnedUnits: returnRows.get(r.sku) ?? 0,
        stock: r.vupId ? (stockByVup.get(r.vupId) ?? 0) : 0,
      };
    });

    skus.sort((a, b) => b.revenue - a.revenue);

    const units = skus.reduce((s, r) => s + r.units, 0);
    const revenue = round2(skus.reduce((s, r) => s + r.revenue, 0));
    const costedRevenue = round2([...bySku.values()].reduce((s, r) => s + r.costedRevenue, 0));
    const cost = round2([...bySku.values()].reduce((s, r) => s + r.cost, 0));
    const margin = round2(costedRevenue - cost);
    const returnedUnits = skus.reduce((s, r) => s + r.returnedUnits, 0);

    const [zeroSale, zeroSaleTotal] = await Promise.all([
      zeroSaleSkus(range, productWhere, hasProductFilter),
      zeroSaleCount(range, productWhere, hasProductFilter),
    ]);

    return {
      range: { from: range.fromISO, to: range.toISO, days: range.days },
      totals: {
        skusSold: skus.length,
        units,
        revenue,
        costedRevenue,
        cost,
        margin,
        marginPercent: costedRevenue ? Math.round((margin / costedRevenue) * 1000) / 10 : null,
        costCoverage: ratio(costedRevenue, revenue),
        returnedUnits,
        returnRate: ratio(returnedUnits, units),
        zeroSaleSkus: zeroSaleTotal,
      },
      skus: skus.slice(0, SKU_LIMIT),
      skusTruncated: skus.length > SKU_LIMIT,
      byCategory: groupRows(skus, (r) => r.category, revenue),
      byBrand: groupRows(skus, (r) => r.brand, revenue),
      bestSellers: [...skus].sort((a, b) => b.units - a.units).slice(0, 10),
      slowMovers: [...skus].filter((r) => r.units > 0).sort((a, b) => a.units - b.units).slice(0, 10),
      zeroSale,
      zeroSaleTruncated: zeroSaleTotal > zeroSale.length,
    };
  },
};

async function categoryNameMap(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id != null))];
  if (unique.length === 0) return new Map();
  const rows = await db.productCategory.findMany({
    where: { id: { in: unique.map((id) => BigInt(id)) } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [String(r.id), r.name]));
}

function groupRows(skus: SkuRow[], pick: (row: SkuRow) => string, total: number): GroupRow[] {
  const map = new Map<string, { skus: number; units: number; revenue: number }>();
  for (const row of skus) {
    const key = pick(row);
    const acc = map.get(key) ?? { skus: 0, units: 0, revenue: 0 };
    acc.skus += 1;
    acc.units += row.units;
    acc.revenue = round2(acc.revenue + row.revenue);
    map.set(key, acc);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: key, ...v, share: ratio(v.revenue, total) }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Units sent back in the window, keyed by the SKU snapshot on the returned line. */
async function returnedUnitsBySku(range: { from: Date; to: Date }): Promise<Map<string, number>> {
  const rows = await db.return_items.findMany({
    where: {
      is_active: true,
      return_requests: { is_active: true, requested_at: inRange(range) },
    },
    select: { quantity: true, order_items: { select: { sku_snapshot: true } } },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const sku = r.order_items?.sku_snapshot;
    if (!sku) continue;
    map.set(sku, (map.get(sku) ?? 0) + r.quantity);
  }
  return map;
}

function zeroSaleWhere(
  range: { from: Date; to: Date },
  productWhere: Prisma.ProductWhereInput,
  hasProductFilter: boolean
): Prisma.VariantUnitPriceWhereInput {
  return {
    isActive: true,
    deleted_at: null,
    orderItems: { none: { is_active: true, order: { ...SOLD_ORDER, createdAt: inRange(range) } } },
    ...(hasProductFilter ? { variant: { item: { style: { product: productWhere } } } } : {}),
  };
}

async function zeroSaleCount(
  range: { from: Date; to: Date },
  productWhere: Prisma.ProductWhereInput,
  hasProductFilter: boolean
): Promise<number> {
  return db.variantUnitPrice.count({ where: zeroSaleWhere(range, productWhere, hasProductFilter) });
}

/** Live SKUs with no sale in the window - the stock that is just sitting there. */
async function zeroSaleSkus(
  range: { from: Date; to: Date },
  productWhere: Prisma.ProductWhereInput,
  hasProductFilter: boolean
): Promise<SkuRow[]> {
  const rows = await db.variantUnitPrice.findMany({
    where: zeroSaleWhere(range, productWhere, hasProductFilter),
    take: ZERO_SALE_LIMIT,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      sku: true,
      base_price: true,
      avg_cost: true,
      inventories: { select: { quantity_available: true } },
      variant: {
        select: {
          item: {
            select: {
              style: {
                select: {
                  name: true,
                  product: { select: { categoryId: true, brand: { select: { name: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  const names = await categoryNameMap(
    rows.map((r) => {
      const id = r.variant?.item?.style?.product?.categoryId;
      return id != null ? String(id) : null;
    })
  );

  return rows.map((r) => {
    const product = r.variant?.item?.style;
    const categoryId = product?.product?.categoryId;
    return {
      key: `v${r.id}`,
      sku: r.sku,
      product: product?.name ?? "—",
      variant: "—",
      category: (categoryId != null ? names.get(String(categoryId)) : null) ?? "Uncategorised",
      brand: product?.product?.brand?.name ?? "No brand",
      units: 0,
      revenue: 0,
      orders: 0,
      cost: r.avg_cost != null ? num(r.avg_cost) : null,
      margin: null,
      marginPercent: null,
      returnedUnits: 0,
      stock: r.inventories?.quantity_available ?? 0,
    };
  });
}
