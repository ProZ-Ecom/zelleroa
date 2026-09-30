import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import type { AuditActor } from "../constants";
import { writeAudit } from "./commission-audit";

type Client = Prisma.TransactionClient | typeof db;

export type RateSource = "product" | "category" | "global" | "none";
export interface ResolvedRate {
  percentage: number;
  source: RateSource;
}

const MAX_CATEGORY_DEPTH = 10;

/** The product's category followed by its ancestors, nearest first. */
async function categoryChain(client: Client, categoryId: bigint | null): Promise<bigint[]> {
  const chain: bigint[] = [];
  let current = categoryId;
  while (current && chain.length < MAX_CATEGORY_DEPTH && !chain.includes(current)) {
    chain.push(current);
    const row: { parentId: bigint | null } | null = await client.productCategory.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = row?.parentId ?? null;
  }
  return chain;
}

/**
 * Commission priority: product-specific, then category-specific (walking up
 * to parent categories), then the global default. Nothing is hard-coded - if
 * no rate is configured the result is 0% with source "none".
 */
export async function resolveCommissionRate(
  client: Client,
  productId: bigint,
  categoryId: bigint | null
): Promise<ResolvedRate> {
  const chain = await categoryChain(client, categoryId);
  const keys = [`product:${productId}`, ...chain.map((id) => `category:${id}`), "global"];

  const rates = await client.commission_rates.findMany({
    where: { scope_key: { in: keys }, is_active: true },
    select: { scope_key: true, scope: true, percentage: true },
  });
  const byKey = new Map(rates.map((r) => [r.scope_key, r]));

  for (const key of keys) {
    const rate = byKey.get(key);
    if (rate) {
      return { percentage: Number(rate.percentage), source: rate.scope as RateSource };
    }
  }
  return { percentage: 0, source: "none" };
}

/** Commission for one line, computed in paise so rounding is deterministic. */
export function calculateCommissionAmount(productAmount: number, percentage: number): number {
  const amountPaise = Math.round(productAmount * 100);
  const basisPoints = Math.round(percentage * 100);
  return Math.round((amountPaise * basisPoints) / 10000) / 100;
}

export interface UpsertRateInput {
  scope: "global" | "category" | "product";
  categoryId?: string | null;
  productId?: string | null;
  percentage: number;
  isActive?: boolean;
}

export const commissionRateService = {
  async list() {
    const rows = await db.commission_rates.findMany({
      orderBy: [{ scope: "asc" }, { id: "asc" }],
      include: {
        category: { select: { id: true, uuid: true, name: true } },
        product: { select: { id: true, uuid: true, name: true } },
      },
    });
    return rows.map((r) => ({
      id: String(r.id),
      scope: r.scope,
      categoryId: r.category?.uuid ?? (r.category ? String(r.category.id) : null),
      categoryName: r.category?.name ?? null,
      productId: r.product?.uuid ?? (r.product ? String(r.product.id) : null),
      productName: r.product?.name ?? null,
      percentage: Number(r.percentage),
      isActive: r.is_active,
      updatedAt: r.updated_at.toISOString(),
    }));
  },

  /** Options for the admin pickers. */
  async targets() {
    const [categories, products] = await Promise.all([
      db.productCategory.findMany({
        where: { deleted_at: null },
        select: { uuid: true, id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.product.findMany({
        where: { deleted_at: null },
        select: { uuid: true, id: true, name: true },
        orderBy: { name: "asc" },
        take: 1000,
      }),
    ]);
    return {
      categories: categories.map((c) => ({ id: c.uuid ?? String(c.id), name: c.name })),
      products: products.map((p) => ({ id: p.uuid ?? String(p.id), name: p.name })),
    };
  },

  async upsert(input: UpsertRateInput, actor: AuditActor) {
    if (input.percentage < 0 || input.percentage > 100) {
      throw ApiError.badRequest("Commission percentage must be between 0 and 100");
    }

    let scopeKey = "global";
    let categoryId: bigint | null = null;
    let productId: bigint | null = null;

    if (input.scope === "category") {
      if (!input.categoryId) throw ApiError.badRequest("Select a category");
      const category = await db.productCategory.findFirst({
        where: { OR: [{ uuid: input.categoryId }, ...(/^\d+$/.test(input.categoryId) ? [{ id: BigInt(input.categoryId) }] : [])] },
        select: { id: true },
      });
      if (!category) throw ApiError.notFound("Category not found");
      categoryId = category.id;
      scopeKey = `category:${category.id}`;
    } else if (input.scope === "product") {
      if (!input.productId) throw ApiError.badRequest("Select a product");
      const product = await db.product.findFirst({
        where: { OR: [{ uuid: input.productId }, ...(/^\d+$/.test(input.productId) ? [{ id: BigInt(input.productId) }] : [])] },
        select: { id: true },
      });
      if (!product) throw ApiError.notFound("Product not found");
      productId = product.id;
      scopeKey = `product:${product.id}`;
    }

    return db.$transaction(async (tx) => {
      const existing = await tx.commission_rates.findUnique({ where: { scope_key: scopeKey } });
      const isActive = input.isActive ?? true;
      const saved = existing
        ? await tx.commission_rates.update({
            where: { id: existing.id },
            data: { percentage: input.percentage, is_active: isActive, updated_by: actor.id },
          })
        : await tx.commission_rates.create({
            data: {
              scope: input.scope,
              scope_key: scopeKey,
              category_id: categoryId,
              product_id: productId,
              percentage: input.percentage,
              is_active: isActive,
              created_by: actor.id,
              updated_by: actor.id,
            },
          });

      await writeAudit(tx, {
        entityType: "rate",
        entityId: saved.id,
        action: existing ? "rate_updated" : "rate_created",
        actor,
        metadata: {
          scopeKey,
          from: existing ? Number(existing.percentage) : null,
          to: input.percentage,
          isActive,
        },
      });
      return { id: String(saved.id), scopeKey };
    });
  },

  async remove(id: string, actor: AuditActor) {
    if (!/^\d+$/.test(id)) throw ApiError.badRequest("Invalid rate id");
    const existing = await db.commission_rates.findUnique({ where: { id: BigInt(id) } });
    if (!existing) throw ApiError.notFound("Commission rate not found");

    await db.$transaction(async (tx) => {
      await tx.commission_rates.delete({ where: { id: existing.id } });
      await writeAudit(tx, {
        entityType: "rate",
        entityId: existing.id,
        action: "rate_deleted",
        actor,
        metadata: { scopeKey: existing.scope_key, percentage: Number(existing.percentage) },
      });
    });
  },
};
