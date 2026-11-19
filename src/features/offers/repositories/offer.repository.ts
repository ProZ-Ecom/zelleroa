import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import {
  formatVariantMeasurement,
  formatMeasurementLabel,
} from "@/features/variants/utils/measurement.util";
import { computeOfferStatus } from "../services/offer-calculation";
import type {
  ApplicableOffer,
  GetOffersParams,
  OfferItemTarget,
  OfferLevel,
  OfferListItem,
  OfferProductTarget,
  OfferType,
} from "../types";

// ---------------------------------------------------------------------------
// Row shaping
// ---------------------------------------------------------------------------

const unitPriceTargetSelect = {
  id: true,
  uuid: true,
  sku: true,
  base_price: true,
  unit_value: true,
  isActive: true,
  product_units: {
    select: { id: true, uuid: true, name: true, code: true, type: true },
  },
  inventories: { select: { quantity_available: true, quantity_reserved: true } },
  variant: {
    select: {
      id: true,
      uuid: true,
      variant_name: true,
      out_of_stock: true,
      style: { select: { id: true, uuid: true, name: true, productId: true, product: {
                select: {
                  id: true,
                  uuid: true,
                  name: true,
                  categoryId: true,
                },
              } } },
    },
  },
} satisfies Prisma.VariantUnitPriceSelect;

const offerInclude = {
  offer_products: {
    include: {
      products: {
        select: { id: true, uuid: true, name: true, categoryId: true },
      },
    },
  },
  offer_items: {
    include: { variant_unit_price: { select: unitPriceTargetSelect } },
  },
} satisfies Prisma.OfferInclude;

type OfferRow = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;
type UnitPriceTargetRow = Prisma.VariantUnitPriceGetPayload<{
  select: typeof unitPriceTargetSelect;
}>;

function stockOf(row: UnitPriceTargetRow): { inStock: boolean; quantity: number } {
  const available = row.inventories
    ? Math.max(
        0,
        row.inventories.quantity_available - row.inventories.quantity_reserved
      )
    : 0;
  return {
    inStock: available > 0 && !row.variant?.out_of_stock,
    quantity: available,
  };
}

export function toOfferItemTarget(row: UnitPriceTargetRow): OfferItemTarget {
  const measurement = formatVariantMeasurement(row.product_units, row.unit_value ?? 0);
  const variantName = row.variant?.variant_name || "";
  const productName = row.variant?.style?.product?.name || "";
  const packLabel = formatMeasurementLabel(measurement);
  const stock = stockOf(row);

  return {
    id: row.uuid,
    sku: row.sku,
    label: [productName, variantName, packLabel].filter(Boolean).join(" - "),
    measurement,
    basePrice: Number(row.base_price),
    productId: row.variant?.style?.product?.uuid || "",
    productName,
    variantId: row.variant?.uuid || "",
    variantName,
    inStock: stock.inStock,
    stockQuantity: stock.quantity,
  };
}

function toOfferProductTarget(product: {
  uuid: string | null;
  name: string;
  categoryId: bigint | null;
}): OfferProductTarget {
  return {
    id: product.uuid || "",
    name: product.name,
    // Filled in by `attachCategoryNames` - the products relation does not
    // carry the category row, and loading it per product would N+1.
    categoryId: product.categoryId != null ? String(product.categoryId) : null,
    categoryName: null,
  };
}

function toOfferListItem(offer: OfferRow): OfferListItem {
  return {
    id: offer.uuid || String(offer.id),
    name: offer.name,
    code: offer.code,
    level: offer.level as OfferLevel,
    type: offer.type as OfferType,
    value: Number(offer.value),
    buyQuantity: offer.buy_quantity,
    getQuantity: offer.get_quantity,
    minQuantity: offer.min_quantity,
    maxQuantity: offer.max_quantity,
    minCartValue: offer.minOrderAmount != null ? Number(offer.minOrderAmount) : null,
    maxDiscountAmount:
      offer.max_discount_amount != null ? Number(offer.max_discount_amount) : null,
    priority: offer.priority,
    terms: offer.terms,
    startsAt: offer.startsAt ? offer.startsAt.toISOString() : null,
    endsAt: offer.ends_at ? offer.ends_at.toISOString() : null,
    isActive: offer.isActive,
    status: computeOfferStatus({
      isActive: offer.isActive,
      startsAt: offer.startsAt,
      endsAt: offer.ends_at,
    }),
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
    products: offer.offer_products
      .filter((op) => op.products)
      .map((op) => toOfferProductTarget(op.products)),
    items: offer.offer_items
      .filter((oi) => oi.variant_unit_price)
      .map((oi) => toOfferItemTarget(oi.variant_unit_price)),
  };
}

/**
 * `toOfferProductTarget` leaves `categoryId` holding the raw primary key,
 * because `products` has no Prisma relation to its category. This swaps every
 * one of them for the public UUID and name in a single query, however many
 * products are involved.
 */
async function resolveCategoryLabels(targets: OfferProductTarget[]): Promise<void> {
  const categoryIds = new Set(
    targets.map((t) => t.categoryId).filter((id): id is string => !!id)
  );
  if (categoryIds.size === 0) return;

  const categories = await db.productCategory.findMany({
    where: { id: { in: [...categoryIds].map((id) => BigInt(id)) } },
    select: { id: true, uuid: true, name: true },
  });

  const byId = new Map(
    categories.map((c) => [String(c.id), { uuid: c.uuid || String(c.id), name: c.name }])
  );

  for (const target of targets) {
    const category = target.categoryId ? byId.get(target.categoryId) : undefined;
    target.categoryId = category?.uuid ?? null;
    target.categoryName = category?.name ?? null;
  }
}

async function attachCategoryNames(offers: OfferListItem[]): Promise<OfferListItem[]> {
  await resolveCategoryLabels(offers.flatMap((offer) => offer.products));
  return offers;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function statusWhere(
  status: NonNullable<GetOffersParams["status"]>,
  now: Date
): Prisma.OfferWhereInput {
  switch (status) {
    case "inactive":
      return { isActive: false };
    case "expired":
      return { isActive: true, ends_at: { lt: now } };
    case "scheduled":
      return { isActive: true, startsAt: { gt: now } };
    case "active":
      return {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
        ],
      };
  }
}

type OfferWhereParams = GetOffersParams & { categoryInternalId?: bigint | null };

function buildOfferWhere(params: OfferWhereParams, now: Date): Prisma.OfferWhereInput {
  const and: Prisma.OfferWhereInput[] = [{ deleted_at: null }];

  if (params.level) and.push({ level: params.level });
  if (params.type) and.push({ type: params.type });
  if (params.status) and.push(statusWhere(params.status, now));

  if (params.search) {
    and.push({
      OR: [
        { name: { contains: params.search } },
        { code: { contains: params.search } },
      ],
    });
  }

  // A product filter matches both the product-wise offers naming it and the
  // item-wise offers targeting one of its pack sizes.
  if (params.productId) {
    and.push({
      OR: [
        { offer_products: { some: { products: { uuid: params.productId } } } },
        {
          offer_items: {
            some: {
              variant_unit_price: { variant: { style: { product: { uuid: params.productId } } } },
            },
          },
        },
      ],
    });
  }

  // `products.category_id` is a bare column with no Prisma relation, so the
  // category filter is applied by the caller as a resolved primary key.
  if (params.categoryInternalId != null) {
    const categoryId = params.categoryInternalId;
    and.push({
      OR: [
        { offer_products: { some: { products: { categoryId } } } },
        {
          offer_items: {
            some: { variant_unit_price: { variant: { style: { product: { categoryId } } } } },
          },
        },
      ],
    });
  }

  // Date range = offers whose window overlaps the requested range.
  if (params.startDate) {
    const from = new Date(params.startDate);
    if (!Number.isNaN(from.getTime())) {
      and.push({ OR: [{ ends_at: null }, { ends_at: { gte: from } }] });
    }
  }
  if (params.endDate) {
    const to = new Date(params.endDate);
    if (!Number.isNaN(to.getTime())) {
      and.push({ OR: [{ startsAt: null }, { startsAt: { lte: to } }] });
    }
  }

  return { AND: and };
}

function buildOrderBy(params: GetOffersParams): Prisma.OfferOrderByWithRelationInput {
  const direction = params.sortOrder ?? "desc";
  switch (params.sortBy) {
    case "name":
      return { name: direction };
    case "priority":
      return { priority: direction };
    case "startsAt":
      return { startsAt: direction };
    case "endsAt":
      return { ends_at: direction };
    default:
      return { createdAt: direction };
  }
}

// ---------------------------------------------------------------------------
// Applicable-offer lookup
// ---------------------------------------------------------------------------

/** Only offers that are switched on and inside their window are ever loaded. */
function liveOfferWhere(now: Date): Prisma.OfferWhereInput {
  return {
    deleted_at: null,
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
    ],
  };
}

const applicableOfferSelect = {
  id: true,
  uuid: true,
  name: true,
  code: true,
  level: true,
  type: true,
  value: true,
  buy_quantity: true,
  get_quantity: true,
  min_quantity: true,
  max_quantity: true,
  minOrderAmount: true,
  max_discount_amount: true,
  priority: true,
  terms: true,
  startsAt: true,
  ends_at: true,
  isActive: true,
} satisfies Prisma.OfferSelect;

type ApplicableOfferRow = Prisma.OfferGetPayload<{ select: typeof applicableOfferSelect }>;

function toApplicableOffer(row: ApplicableOfferRow): ApplicableOffer {
  return {
    id: row.uuid || String(row.id),
    internalId: row.id,
    name: row.name,
    code: row.code,
    level: row.level as OfferLevel,
    type: row.type as OfferType,
    value: Number(row.value),
    buyQuantity: row.buy_quantity,
    getQuantity: row.get_quantity,
    minQuantity: row.min_quantity,
    maxQuantity: row.max_quantity,
    minCartValue: row.minOrderAmount != null ? Number(row.minOrderAmount) : null,
    maxDiscountAmount:
      row.max_discount_amount != null ? Number(row.max_discount_amount) : null,
    priority: row.priority,
    terms: row.terms,
    startsAt: row.startsAt,
    endsAt: row.ends_at,
    isActive: row.isActive,
  };
}

/**
 * `products.category_id` has no Prisma relation, so any filter expressed as a
 * category UUID has to be turned into a primary key first.
 */
async function resolveCategoryInternalId(uuid?: string): Promise<bigint | null> {
  if (!uuid) return null;
  const category = await db.productCategory.findFirst({
    where: { uuid, deleted_at: null },
    select: { id: true },
  });
  return category?.id ?? null;
}

export const offerRepository = {
  // -------------------------------------------------------------------------
  // Admin CRUD
  // -------------------------------------------------------------------------

  async findAll(params: GetOffersParams = {}) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const now = new Date();
    const categoryInternalId = await resolveCategoryInternalId(params.categoryId);
    // An unknown category UUID must match nothing rather than everything.
    if (params.categoryId && categoryInternalId == null) {
      return { data: [], meta: { page, limit, total: 0, totalPages: 1 } };
    }
    const where = buildOfferWhere({ ...params, categoryInternalId }, now);

    const [rows, total] = await Promise.all([
      db.offer.findMany({
        where,
        include: offerInclude,
        orderBy: buildOrderBy(params),
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.offer.count({ where }),
    ]);

    const data = await attachCategoryNames(rows.map(toOfferListItem));

    return {
      data,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async findByUuid(uuid: string): Promise<OfferListItem | null> {
    const offer = await db.offer.findFirst({
      where: { uuid, deleted_at: null },
      include: offerInclude,
    });
    if (!offer) return null;
    const [withCategory] = await attachCategoryNames([toOfferListItem(offer)]);
    return withCategory;
  },

  async findInternalIdByUuid(uuid: string): Promise<bigint | null> {
    const offer = await db.offer.findFirst({
      where: { uuid, deleted_at: null },
      select: { id: true },
    });
    return offer?.id ?? null;
  },

  async findByCode(code: string, excludeUuid?: string) {
    return db.offer.findFirst({
      where: {
        code,
        deleted_at: null,
        ...(excludeUuid ? { NOT: { uuid: excludeUuid } } : {}),
      },
      select: { id: true, uuid: true, name: true },
    });
  },

  async create(data: {
    name: string;
    code: string | null;
    level: OfferLevel;
    type: OfferType;
    value: number;
    buyQuantity: number | null;
    getQuantity: number | null;
    minQuantity: number;
    maxQuantity: number | null;
    minCartValue: number | null;
    maxDiscountAmount: number | null;
    priority: number;
    terms: string | null;
    startsAt: Date;
    endsAt: Date;
    isActive: boolean;
    productIds: bigint[];
    itemIds: bigint[];
    actorId?: bigint | null;
  }) {
    const offer = await db.offer.create({
      data: {
        // `offers.uuid` defaults to the *string* "UUID()" rather than a
        // generated value, so every row would otherwise share one id. The
        // rest of the codebase generates it here for the same reason.
        uuid: crypto.randomUUID(),
        name: data.name,
        code: data.code,
        level: data.level,
        type: data.type,
        value: data.value,
        buy_quantity: data.buyQuantity,
        get_quantity: data.getQuantity,
        min_quantity: data.minQuantity,
        max_quantity: data.maxQuantity,
        minOrderAmount: data.minCartValue,
        max_discount_amount: data.maxDiscountAmount,
        priority: data.priority,
        terms: data.terms,
        startsAt: data.startsAt,
        ends_at: data.endsAt,
        isActive: data.isActive,
        created_by: data.actorId ?? undefined,
        updated_by: data.actorId ?? undefined,
        offer_products: {
          create: data.productIds.map((productId) => ({
            uuid: crypto.randomUUID(),
            product_id: productId,
            created_by: data.actorId ?? undefined,
          })),
        },
        offer_items: {
          create: data.itemIds.map((itemId) => ({
            uuid: crypto.randomUUID(),
            variant_unit_price_id: itemId,
            created_by: data.actorId ?? undefined,
          })),
        },
      },
      include: offerInclude,
    });

    const [withCategory] = await attachCategoryNames([toOfferListItem(offer)]);
    return withCategory;
  },

  async update(
    id: bigint,
    data: {
      name?: string;
      code?: string | null;
      level?: OfferLevel;
      type?: OfferType;
      value?: number;
      buyQuantity?: number | null;
      getQuantity?: number | null;
      minQuantity?: number;
      maxQuantity?: number | null;
      minCartValue?: number | null;
      maxDiscountAmount?: number | null;
      priority?: number;
      terms?: string | null;
      startsAt?: Date;
      endsAt?: Date;
      isActive?: boolean;
      productIds?: bigint[];
      itemIds?: bigint[];
      actorId?: bigint | null;
    }
  ) {
    const updateData: Prisma.OfferUncheckedUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.buyQuantity !== undefined) updateData.buy_quantity = data.buyQuantity;
    if (data.getQuantity !== undefined) updateData.get_quantity = data.getQuantity;
    if (data.minQuantity !== undefined) updateData.min_quantity = data.minQuantity;
    if (data.maxQuantity !== undefined) updateData.max_quantity = data.maxQuantity;
    if (data.minCartValue !== undefined) updateData.minOrderAmount = data.minCartValue;
    if (data.maxDiscountAmount !== undefined)
      updateData.max_discount_amount = data.maxDiscountAmount;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.terms !== undefined) updateData.terms = data.terms;
    if (data.startsAt !== undefined) updateData.startsAt = data.startsAt;
    if (data.endsAt !== undefined) updateData.ends_at = data.endsAt;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.actorId != null) updateData.updated_by = data.actorId;

    const offer = await db.$transaction(async (tx) => {
      if (data.productIds !== undefined) {
        await tx.offer_products.deleteMany({ where: { offer_id: id } });
        if (data.productIds.length > 0) {
          await tx.offer_products.createMany({
            data: data.productIds.map((productId) => ({
              uuid: crypto.randomUUID(),
              offer_id: id,
              product_id: productId,
              created_by: data.actorId ?? undefined,
            })),
          });
        }
      }

      if (data.itemIds !== undefined) {
        await tx.offer_items.deleteMany({ where: { offer_id: id } });
        if (data.itemIds.length > 0) {
          await tx.offer_items.createMany({
            data: data.itemIds.map((itemId) => ({
              uuid: crypto.randomUUID(),
              offer_id: id,
              variant_unit_price_id: itemId,
              created_by: data.actorId ?? undefined,
            })),
          });
        }
      }

      return tx.offer.update({
        where: { id },
        data: updateData,
        include: offerInclude,
      });
    });

    const [withCategory] = await attachCategoryNames([toOfferListItem(offer)]);
    return withCategory;
  },

  async setStatus(id: bigint, isActive: boolean, actorId?: bigint | null) {
    const offer = await db.offer.update({
      where: { id },
      data: { isActive, updated_by: actorId ?? undefined },
      include: offerInclude,
    });
    const [withCategory] = await attachCategoryNames([toOfferListItem(offer)]);
    return withCategory;
  },

  /** Soft delete, matching the rest of the catalog. */
  async softDelete(id: bigint, actorId?: bigint | null) {
    return db.offer.update({
      where: { id },
      data: { deleted_at: new Date(), isActive: false, updated_by: actorId ?? undefined },
      select: { id: true },
    });
  },

  // -------------------------------------------------------------------------
  // Target resolution
  // -------------------------------------------------------------------------

  /**
   * Map product UUIDs to primary keys, rejecting anything deleted so an offer
   * can never point at a removed product.
   */
  async resolveProductIds(uuids: string[]) {
    if (uuids.length === 0) return { ids: [] as bigint[], missing: [] as string[] };
    const products = await db.product.findMany({
      where: { uuid: { in: uuids }, deleted_at: null },
      select: { id: true, uuid: true },
    });
    const found = new Map(products.map((p) => [p.uuid, p.id]));
    return {
      ids: products.map((p) => p.id),
      missing: uuids.filter((uuid) => !found.has(uuid)),
    };
  },

  /** Same for pack sizes; the parent variant and product must be live too. */
  async resolveItemIds(uuids: string[]) {
    if (uuids.length === 0) return { ids: [] as bigint[], missing: [] as string[] };
    const rows = await db.variantUnitPrice.findMany({
      where: {
        uuid: { in: uuids },
        deleted_at: null,
        variant: {
          deleted_at: null,
          style: { deleted_at: null, product: { deleted_at: null } },
        },
      },
      select: { id: true, uuid: true },
    });
    const found = new Set(rows.map((r) => r.uuid));
    return {
      ids: rows.map((r) => r.id),
      missing: uuids.filter((uuid) => !found.has(uuid)),
    };
  },

  /** Base prices of the pack sizes an offer targets, for "discount > price" checks. */
  async findPricesForItems(itemIds: bigint[]) {
    if (itemIds.length === 0) return [];
    const rows = await db.variantUnitPrice.findMany({
      where: { id: { in: itemIds } },
      select: { uuid: true, sku: true, base_price: true },
    });
    return rows.map((r) => ({
      id: r.uuid,
      sku: r.sku,
      basePrice: Number(r.base_price),
    }));
  },

  /** Base prices of every live pack size under the given products. */
  async findPricesForProducts(productIds: bigint[]) {
    if (productIds.length === 0) return [];
    const rows = await db.variantUnitPrice.findMany({
      where: {
        deleted_at: null,
        isActive: true,
        variant: {
          deleted_at: null,
          style: { deleted_at: null, productId: { in: productIds }, product: { deleted_at: null } },
        },
      },
      select: { uuid: true, sku: true, base_price: true },
    });
    return rows.map((r) => ({
      id: r.uuid,
      sku: r.sku,
      basePrice: Number(r.base_price),
    }));
  },

  // -------------------------------------------------------------------------
  // Dependent dropdowns
  // -------------------------------------------------------------------------

  async findSelectableProducts(params: {
    categoryId?: string;
    search?: string;
    limit: number;
  }): Promise<OfferProductTarget[]> {
    const categoryInternalId = await resolveCategoryInternalId(params.categoryId);
    if (params.categoryId && categoryInternalId == null) return [];

    const products = await db.product.findMany({
      where: {
        deleted_at: null,
        isActive: true,
        ...(categoryInternalId != null ? { categoryId: categoryInternalId } : {}),
        ...(params.search ? { name: { contains: params.search } } : {}),
      },
      select: { uuid: true, name: true, categoryId: true },
      orderBy: { name: "asc" },
      take: params.limit,
    });

    const targets = products.map(toOfferProductTarget);
    await resolveCategoryLabels(targets);
    return targets;
  },

  async findSelectableItems(params: {
    productId?: string;
    categoryId?: string;
    search?: string;
    limit: number;
  }): Promise<OfferItemTarget[]> {
    const categoryInternalId = await resolveCategoryInternalId(params.categoryId);
    if (params.categoryId && categoryInternalId == null) return [];

    const rows = await db.variantUnitPrice.findMany({
      where: {
        deleted_at: null,
        isActive: true,
        variant: {
          deleted_at: null,
          isActive: true,
          style: { deleted_at: null, isActive: true, product: {
                deleted_at: null,
                isActive: true,
                ...(params.productId ? { uuid: params.productId } : {}),
                ...(categoryInternalId != null ? { categoryId: categoryInternalId } : {}),
              } },
        },
        ...(params.search
          ? {
              OR: [
                { sku: { contains: params.search } },
                { variant: { variant_name: { contains: params.search } } },
                {
                  variant: {
                    style: { product: { name: { contains: params.search } } },
                  },
                },
              ],
            }
          : {}),
      },
      select: unitPriceTargetSelect,
      orderBy: [{ variant_id: "asc" }, { unit_value: "asc" }],
      take: params.limit,
    });

    return rows.map(toOfferItemTarget);
  },

  async findItemsByUuids(uuids: string[]): Promise<OfferItemTarget[]> {
    if (uuids.length === 0) return [];
    const rows = await db.variantUnitPrice.findMany({
      where: { uuid: { in: uuids }, deleted_at: null },
      select: unitPriceTargetSelect,
    });
    return rows.map(toOfferItemTarget);
  },

  // -------------------------------------------------------------------------
  // Customer-facing lookups
  // -------------------------------------------------------------------------

  /**
   * Every live offer that could apply to the given pack sizes, keyed by the
   * pack size UUID. Two queries regardless of how many items are asked for:
   * one for item-level targets, one for the product-level targets of the
   * products those items belong to.
   */
  async findApplicableOffersByItemUuids(
    itemUuids: string[],
    now: Date = new Date()
  ): Promise<Map<string, ApplicableOffer[]>> {
    const result = new Map<string, ApplicableOffer[]>();
    const unique = [...new Set(itemUuids.filter(Boolean))];
    if (unique.length === 0) return result;

    const items = await db.variantUnitPrice.findMany({
      where: { uuid: { in: unique }, deleted_at: null },
      select: {
        id: true,
        uuid: true,
        variant: { select: { style: { select: { productId: true } } } },
      },
    });
    if (items.length === 0) return result;

    for (const item of items) result.set(item.uuid, []);

    const itemIds = items.map((i) => i.id);
    const productIds = [
      ...new Set(items.map((i) => i.variant?.style?.productId).filter(Boolean) as bigint[]),
    ];

    const [itemOffers, productOffers] = await Promise.all([
      db.offer_items.findMany({
        where: {
          variant_unit_price_id: { in: itemIds },
          is_active: true,
          offers: { ...liveOfferWhere(now), level: "item" },
        },
        select: {
          variant_unit_price_id: true,
          offers: { select: applicableOfferSelect },
        },
      }),
      productIds.length > 0
        ? db.offer_products.findMany({
            where: {
              product_id: { in: productIds },
              is_active: true,
              offers: { ...liveOfferWhere(now), level: "product" },
            },
            select: {
              product_id: true,
              offers: { select: applicableOfferSelect },
            },
          })
        : Promise.resolve([]),
    ]);

    const offersByItemId = new Map<string, ApplicableOffer[]>();
    for (const row of itemOffers) {
      const key = String(row.variant_unit_price_id);
      const list = offersByItemId.get(key) ?? [];
      list.push(toApplicableOffer(row.offers));
      offersByItemId.set(key, list);
    }

    const offersByProductId = new Map<string, ApplicableOffer[]>();
    for (const row of productOffers) {
      const key = String(row.product_id);
      const list = offersByProductId.get(key) ?? [];
      list.push(toApplicableOffer(row.offers));
      offersByProductId.set(key, list);
    }

    for (const item of items) {
      const productId = item.variant?.style?.productId;
      result.set(item.uuid, [
        ...(offersByItemId.get(String(item.id)) ?? []),
        ...(productId ? offersByProductId.get(String(productId)) ?? [] : []),
      ]);
    }

    return result;
  },

  /** Unit prices for a set of pack-size UUIDs, for server-side re-pricing. */
  async findItemPricesByUuids(itemUuids: string[]) {
    const unique = [...new Set(itemUuids.filter(Boolean))];
    if (unique.length === 0) return new Map<string, { unitPrice: number; productId: string }>();

    const rows = await db.variantUnitPrice.findMany({
      where: { uuid: { in: unique }, deleted_at: null },
      select: {
        uuid: true,
        base_price: true,
        variant: {
          select: { style: { select: { product: { select: { uuid: true } } } } },
        },
      },
    });

    return new Map(
      rows.map((r) => [
        r.uuid,
        {
          unitPrice: Number(r.base_price),
          productId: r.variant?.style?.product?.uuid ?? "",
        },
      ])
    );
  },

  /** Offers listed against one product (product-level targets only). */
  async findOffersByProductUuid(productUuid: string, activeOnly: boolean) {
    const now = new Date();
    const rows = await db.offer.findMany({
      where: {
        deleted_at: null,
        ...(activeOnly ? liveOfferWhere(now) : {}),
        offer_products: { some: { is_active: true, products: { uuid: productUuid } } },
      },
      include: offerInclude,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return attachCategoryNames(rows.map(toOfferListItem));
  },

  /** Offers reaching one pack size, by either route. */
  async findOffersByItemUuid(itemUuid: string, activeOnly: boolean) {
    const now = new Date();
    const rows = await db.offer.findMany({
      where: {
        deleted_at: null,
        ...(activeOnly ? liveOfferWhere(now) : {}),
        OR: [
          {
            offer_items: {
              some: { is_active: true, variant_unit_price: { uuid: itemUuid } },
            },
          },
          {
            offer_products: {
              some: {
                is_active: true,
                products: {
                  styles: {
                    some: {
                      variants: {
                        some: { variant_unit_prices: { some: { uuid: itemUuid } } },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      include: offerInclude,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return attachCategoryNames(rows.map(toOfferListItem));
  },

  /**
   * Live offers that clash with the one being saved: same level, same type and
   * an overlapping window on a shared target.
   */
  async findConflictingOffers(params: {
    level: OfferLevel;
    type: OfferType;
    startsAt: Date;
    endsAt: Date;
    productIds: bigint[];
    itemIds: bigint[];
    excludeId?: bigint;
  }) {
    const targetWhere: Prisma.OfferWhereInput =
      params.level === "product"
        ? { offer_products: { some: { product_id: { in: params.productIds } } } }
        : { offer_items: { some: { variant_unit_price_id: { in: params.itemIds } } } };

    const hasTargets =
      params.level === "product" ? params.productIds.length > 0 : params.itemIds.length > 0;
    if (!hasTargets) return [];

    return db.offer.findMany({
      where: {
        deleted_at: null,
        isActive: true,
        level: params.level,
        type: params.type,
        ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
        // Two windows overlap unless one ends before the other starts.
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: params.endsAt } }] },
          { OR: [{ ends_at: null }, { ends_at: { gte: params.startsAt } }] },
        ],
        ...targetWhere,
      },
      select: { id: true, uuid: true, name: true, priority: true },
      take: 5,
    });
  },
};
