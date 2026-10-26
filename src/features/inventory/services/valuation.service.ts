import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import type { Prisma } from "@/generated/prisma";
import type {
  SalesMarginReport,
  SalesMarginRow,
  ValuationGroupBy,
  ValuationReport,
  ValuationRow,
} from "../types/valuation";
import type { ValuationQuery } from "../validations/valuation.schema";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Orders in these states never happened as far as margin is concerned. */
const NON_SALE_STATUSES = ["cancelled", "returned"] as const;

/** Deepest sensible category nesting; the loop stops here rather than spinning on a cycle. */
const MAX_CATEGORY_DEPTH = 6;

const UNGROUPED = { key: "", name: "Not set" };

/**
 * Cost of one unit: the blended average where there is one, otherwise the last
 * price paid. Null means this SKU has never been bought, so it cannot be valued.
 */
function unitCost(row: { avg_cost: Prisma.Decimal | null; cost_price: Prisma.Decimal | null }) {
  if (row.avg_cost !== null) return Number(row.avg_cost);
  if (row.cost_price !== null) return Number(row.cost_price);
  return null;
}

function marginOf(profit: number, revenue: number) {
  if (revenue <= 0) return null;
  return round2((profit / revenue) * 100);
}

/** Category has no relation on Product, so names are resolved from a lookup. */
async function categoryNames() {
  const rows = await db.productCategory.findMany({ select: { id: true, name: true, slug: true } });
  return new Map(rows.map((c) => [String(c.id), { key: c.slug, name: c.name }]));
}

async function categoryFilterIds(slug: string) {
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

async function productFilter(params: ValuationQuery): Promise<Prisma.ProductWhereInput> {
  return {
    deleted_at: null,
    ...(params.categorySlug
      ? { categoryId: { in: await categoryFilterIds(params.categorySlug) } }
      : {}),
    ...(params.brandSlug ? { brand: { slug: params.brandSlug } } : {}),
  };
}

type GroupId = { key: string; name: string };

function groupIdOf(
  groupBy: ValuationGroupBy,
  product: { categoryId: bigint | null; brand: { slug: string; name: string } | null } | null,
  names: Map<string, GroupId> | null
): GroupId {
  if (groupBy === "category") {
    const found = product?.categoryId ? names?.get(String(product.categoryId)) : undefined;
    return found ?? UNGROUPED;
  }
  return product?.brand ? { key: product.brand.slug, name: product.brand.name } : UNGROUPED;
}

function bucketOf<T extends { key: string; name: string }>(
  map: Map<string, T>,
  id: GroupId,
  blank: () => T
) {
  const existing = map.get(id.key);
  if (existing) return existing;
  const created = { ...blank(), key: id.key, name: id.name };
  map.set(id.key, created);
  return created;
}

export const valuationService = {
  /**
   * What the stock on hand is worth, and what it would make if it all sold at
   * today's prices. A SKU that has never been bought has no cost, so it is left
   * out of every money column and counted separately instead: including it
   * would show its whole retail value as profit.
   */
  async stockValuation(params: ValuationQuery): Promise<ValuationReport> {
    const groupBy: ValuationGroupBy = params.groupBy ?? "category";
    const names = groupBy === "category" ? await categoryNames() : null;

    const rows = await db.variantUnitPrice.findMany({
      where: {
        deleted_at: null,
        variant: {
          deleted_at: null,
          item: {
            deleted_at: null,
            style: { deleted_at: null, product: await productFilter(params) },
          },
        },
      },
      select: {
        base_price: true,
        cost_price: true,
        avg_cost: true,
        inventories: { select: { quantity_available: true } },
        variant: {
          select: {
            item: {
              select: {
                style: {
                  select: {
                    product: {
                      select: { categoryId: true, brand: { select: { slug: true, name: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const blank = (): ValuationRow => ({
      key: "",
      name: "",
      skuCount: 0,
      unvaluedSkus: 0,
      units: 0,
      costValue: 0,
      retailValue: 0,
      potentialProfit: 0,
      marginPercent: null,
    });

    const buckets = new Map<string, ValuationRow>();
    const totals = blank();

    for (const row of rows) {
      const id = groupIdOf(groupBy, row.variant?.item?.style?.product ?? null, names);
      const bucket = bucketOf(buckets, id, blank);
      const stock = row.inventories?.quantity_available ?? 0;
      const cost = unitCost(row);

      bucket.skuCount += 1;
      totals.skuCount += 1;
      bucket.units += stock;
      totals.units += stock;

      if (cost === null) {
        bucket.unvaluedSkus += 1;
        totals.unvaluedSkus += 1;
        continue;
      }

      bucket.costValue += cost * stock;
      bucket.retailValue += Number(row.base_price) * stock;
      totals.costValue += cost * stock;
      totals.retailValue += Number(row.base_price) * stock;
    }

    const finish = (r: ValuationRow) => {
      r.costValue = round2(r.costValue);
      r.retailValue = round2(r.retailValue);
      r.potentialProfit = round2(r.retailValue - r.costValue);
      r.marginPercent = marginOf(r.potentialProfit, r.retailValue);
      return r;
    };

    return {
      groupBy,
      rows: [...buckets.values()].map(finish).sort((a, b) => b.costValue - a.costValue),
      totals: finish(totals),
    };
  },

  /**
   * Margin on what was sold in a period. An order item carries no cost of its
   * own, so each one is costed at its SKU's cost today: close enough to steer
   * by, but it moves when the buying price moves, which the screen says out
   * loud. Units whose SKU has no cost at all are counted separately.
   */
  async salesMargin(params: ValuationQuery): Promise<SalesMarginReport> {
    const groupBy: ValuationGroupBy = params.groupBy ?? "category";
    const names = groupBy === "category" ? await categoryNames() : null;

    const to = params.to ?? new Date().toISOString().slice(0, 10);
    const from = params.from ?? `${to.slice(0, 8)}01`;
    // The end date is inclusive, so the window runs to the start of the next day.
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);

    const items = await db.orderItem.findMany({
      where: {
        order: {
          order_status: { notIn: [...NON_SALE_STATUSES] },
          createdAt: { gte: new Date(`${from}T00:00:00.000Z`), lt: end },
        },
        product: await productFilter(params),
      },
      select: {
        orderId: true,
        quantity: true,
        unit_price: true,
        discount_amount: true,
        product: { select: { categoryId: true, brand: { select: { slug: true, name: true } } } },
        variant_unit_price: { select: { avg_cost: true, cost_price: true } },
      },
    });

    const blank = (): SalesMarginRow => ({
      key: "",
      name: "",
      orderCount: 0,
      unitsSold: 0,
      revenue: 0,
      estimatedCost: 0,
      estimatedProfit: 0,
      marginPercent: null,
      unitsWithoutCost: 0,
    });

    const buckets = new Map<string, SalesMarginRow>();
    const ordersPerGroup = new Map<string, Set<string>>();
    const allOrders = new Set<string>();
    const totals = blank();

    for (const item of items) {
      const id = groupIdOf(groupBy, item.product ?? null, names);
      const bucket = bucketOf(buckets, id, blank);

      if (!ordersPerGroup.has(id.key)) ordersPerGroup.set(id.key, new Set());
      ordersPerGroup.get(id.key)!.add(String(item.orderId));
      allOrders.add(String(item.orderId));

      // What the customer paid for the line, after its discount and before tax.
      const revenue = Number(item.unit_price) * item.quantity - Number(item.discount_amount);
      const cost = item.variant_unit_price ? unitCost(item.variant_unit_price) : null;

      bucket.unitsSold += item.quantity;
      bucket.revenue += revenue;
      totals.unitsSold += item.quantity;
      totals.revenue += revenue;

      if (cost === null) {
        bucket.unitsWithoutCost += item.quantity;
        totals.unitsWithoutCost += item.quantity;
        continue;
      }
      bucket.estimatedCost += cost * item.quantity;
      totals.estimatedCost += cost * item.quantity;
    }

    const finish = (r: SalesMarginRow) => {
      r.revenue = round2(r.revenue);
      r.estimatedCost = round2(r.estimatedCost);
      r.estimatedProfit = round2(r.revenue - r.estimatedCost);
      // With nothing costed there is no margin to report: showing the whole
      // revenue as profit would read as 100% when the truth is "not known".
      const nothingCosted = r.unitsSold > 0 && r.unitsWithoutCost === r.unitsSold;
      r.marginPercent = nothingCosted ? null : marginOf(r.estimatedProfit, r.revenue);
      return r;
    };

    const rows = [...buckets.values()].map((r) => {
      r.orderCount = ordersPerGroup.get(r.key)?.size ?? 0;
      return finish(r);
    });
    totals.orderCount = allOrders.size;

    return {
      from,
      to,
      groupBy,
      rows: rows.sort((a, b) => b.revenue - a.revenue),
      totals: finish(totals),
    };
  },
};
