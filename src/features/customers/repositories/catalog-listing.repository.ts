import { db } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma";

/**
 * Reads for the category listing. Everything here is plain loading; turning
 * the Style tree into sellable units, filters and cards happens in
 * `catalog-listing.service.ts`.
 */

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const activeCategoryWhere = {
  isActive: true,
  deleted_at: null,
  status: true,
} satisfies Prisma.ProductCategoryWhereInput;

/**
 * Only Colors with at least one priced, active Size row are sellable - the
 * same rule the Style detail page applies (see `styleItemVariantsArgs`).
 */
const sellableUnitPriceWhere = {
  deleted_at: null,
  isActive: true,
  base_price: { gt: 0 },
} satisfies Prisma.VariantUnitPriceWhereInput;

const listingBrandSelect = {
  select: { id: true, uuid: true, name: true, slug: true, isActive: true, deleted_at: true },
} as const;

const listingStyleSelect = {
  id: true,
  uuid: true,
  name: true,
  short_description: true,
  description: true,
  is_featured: true,
  is_new_arrival: true,
  new_arrival_until: true,
  createdAt: true,
  // The Item's own brand; `product.brand` is only the legacy fallback.
  brand: listingBrandSelect,
  product: {
    select: {
      id: true,
      name: true,
      gender: true,
      categoryId: true,
      brand: listingBrandSelect,
    },
  },
  images: {
    where: { is_active: true },
    orderBy: [{ is_primary: "desc" as const }, { sort_order: "asc" as const }],
    take: 1,
    select: { image_url: true },
  },
  items: {
    where: { deleted_at: null, isActive: true },
    orderBy: [{ is_default: "desc" as const }, { createdAt: "asc" as const }],
    select: {
      id: true,
      uuid: true,
      name: true,
      short_description: true,
      is_default: true,
      is_featured: true,
      out_of_stock: true,
      createdAt: true,
      item_attribute_values: { select: { attribute_id: true, attribute_value_id: true } },
      variants: {
        where: {
          isActive: true,
          deleted_at: null,
          variant_unit_prices: { some: sellableUnitPriceWhere },
        },
        orderBy: [{ is_default: "desc" as const }, { createdAt: "asc" as const }],
        select: {
          id: true,
          is_default: true,
          out_of_stock: true,
          color_name: true,
          color_hex: true,
          product_variant_images: {
            where: { is_active: true },
            orderBy: [{ is_primary: "desc" as const }, { sort_order: "asc" as const }],
            take: 1,
            select: { image_url: true },
          },
          variant_attribute_values: { select: { attribute_id: true, attribute_value_id: true } },
          variant_unit_prices: {
            where: sellableUnitPriceWhere,
            orderBy: [{ is_default: "desc" as const }, { createdAt: "asc" as const }],
            select: {
              uuid: true,
              base_price: true,
              is_default: true,
              attribute_value_id: true,
              inventories: { select: { quantity_available: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.StyleSelect;

export type ListingStyleRow = Prisma.StyleGetPayload<{ select: typeof listingStyleSelect }>;

export interface ListingCategoryRow {
  id: bigint;
  uuid: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parentId: bigint | null;
  image: string | null;
}

export interface ListingAttributeValueRow {
  id: bigint;
  value: string;
  colorHex: string | null;
  attribute: {
    id: bigint;
    name: string;
    slug: string;
    type: "text" | "color";
    multiple: boolean;
  };
}

export const catalogListingRepository = {
  /**
   * Every active category, as a flat list - small enough to load whole, and
   * needed to resolve the requested category's ancestors (breadcrumb) and
   * descendants (a parent category lists its subcategories' products too).
   */
  async findActiveCategories(): Promise<ListingCategoryRow[]> {
    const rows = await db.productCategory.findMany({
      where: activeCategoryWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        uuid: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        parentId: true,
        product_category_images: {
          where: { is_active: true },
          take: 1,
          select: { image_url: true },
        },
      },
    });

    return rows.map(({ product_category_images, ...row }) => ({
      ...row,
      image: row.icon || product_category_images[0]?.image_url || null,
    }));
  },

  /**
   * Resolve a URL key to a category: its UUID, or its slug in any case, with
   * `-` accepted for `_` (`/category/mens-clothing` -> MENS_CLOTHING).
   */
  resolveCategoryKey(categories: ListingCategoryRow[], key: string): ListingCategoryRow | null {
    const trimmed = key.trim();
    if (uuidRegex.test(trimmed)) {
      return categories.find((c) => c.uuid?.toLowerCase() === trimmed.toLowerCase()) ?? null;
    }
    const normalize = (s: string) => s.toLowerCase().replace(/-/g, "_");
    const wanted = normalize(trimmed);
    return categories.find((c) => normalize(c.slug) === wanted) ?? null;
  },

  /**
   * Every live Style under the given categories (all categories when null),
   * with its full Item -> Colour -> Size tree. Filtering, faceting, sorting
   * and pagination all need the whole candidate set, so it is loaded once per
   * request rather than re-queried per filter.
   */
  async findListingStyles(params: {
    categoryIds: bigint[] | null;
    search: string;
  }): Promise<ListingStyleRow[]> {
    const productWhere: Prisma.ProductWhereInput = {
      isActive: true,
      deleted_at: null,
      ...(params.categoryIds ? { categoryId: { in: params.categoryIds } } : {}),
    };

    const where: Prisma.StyleWhereInput = {
      isActive: true,
      deleted_at: null,
      product: productWhere,
      items: {
        some: {
          deleted_at: null,
          isActive: true,
          variants: {
            some: {
              isActive: true,
              deleted_at: null,
              variant_unit_prices: { some: sellableUnitPriceWhere },
            },
          },
        },
      },
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { product: { name: { contains: params.search } } },
        { items: { some: { deleted_at: null, isActive: true, name: { contains: params.search } } } },
      ];
    }

    return db.style.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: listingStyleSelect,
    });
  },

  /**
   * Products under the given categories for the header menu, newest first,
   * each with its live Items (across all its Styles). Only Items with a
   * sellable Colour are included - the same rule the listing applies.
   */
  async findMenuProducts(params: { categoryIds: bigint[]; take: number; gender?: "men" | "women" | "kids" | "unisex" }) {
    const sellableItemWhere = {
      deleted_at: null,
      isActive: true,
      variants: {
        some: {
          isActive: true,
          deleted_at: null,
          variant_unit_prices: { some: sellableUnitPriceWhere },
        },
      },
    } satisfies Prisma.ItemWhereInput;

    return db.product.findMany({
      where: {
        isActive: true,
        deleted_at: null,
        categoryId: { in: params.categoryIds },
        ...(params.gender
          ? {
              gender:
                params.gender === "unisex" ? "unisex" : { in: [params.gender, "unisex"] },
            }
          : {}),
        styles: { some: { isActive: true, deleted_at: null, items: { some: sellableItemWhere } } },
      },
      orderBy: { createdAt: "desc" },
      take: params.take,
      select: {
        id: true,
        uuid: true,
        name: true,
        styles: {
          where: { isActive: true, deleted_at: null },
          orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
          select: {
            images: {
              where: { is_active: true },
              orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
              take: 1,
              select: { image_url: true },
            },
            items: {
              where: sellableItemWhere,
              orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
              select: {
                uuid: true,
                name: true,
                variants: {
                  where: { isActive: true, deleted_at: null },
                  orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
                  take: 1,
                  select: {
                    product_variant_images: {
                      where: { is_active: true },
                      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                      take: 1,
                      select: { image_url: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  /** Active attribute values (under active attributes) among the given ids. */
  async findAttributeValues(ids: bigint[]): Promise<ListingAttributeValueRow[]> {
    if (ids.length === 0) return [];
    const rows = await db.attributeValue.findMany({
      where: { id: { in: ids }, is_active: true, attribute: { is_active: true } },
      select: {
        id: true,
        value: true,
        color_hex: true,
        attribute: {
          select: { id: true, name: true, slug: true, type: true, multiple_selection: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      value: row.value,
      colorHex: row.color_hex,
      attribute: {
        id: row.attribute.id,
        name: row.attribute.name,
        slug: row.attribute.slug,
        type: row.attribute.type,
        multiple: row.attribute.multiple_selection,
      },
    }));
  },

  /** Approved review average/count per Product (reviews are Product-level). */
  async findRatings(productIds: bigint[]): Promise<Map<string, { average: number; count: number }>> {
    const result = new Map<string, { average: number; count: number }>();
    if (productIds.length === 0) return result;

    const rows = await db.review.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, isApproved: true, is_active: true },
      _avg: { rating: true },
      _count: { _all: true },
    });

    for (const row of rows) {
      if (row._count._all > 0 && row._avg.rating !== null) {
        result.set(row.productId.toString(), {
          average: Math.round(row._avg.rating * 10) / 10,
          count: row._count._all,
        });
      }
    }
    return result;
  },

  /** Units sold per Item, excluding cancelled/returned orders. */
  async findUnitsSold(itemIds: bigint[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (itemIds.length === 0) return result;

    const rows = await db.orderItem.groupBy({
      by: ["itemId"],
      where: {
        itemId: { in: itemIds },
        is_active: true,
        order: { order_status: { notIn: ["cancelled", "returned"] } },
      },
      _sum: { quantity: true },
    });

    for (const row of rows) {
      if (row.itemId !== null) result.set(row.itemId.toString(), row._sum.quantity ?? 0);
    }
    return result;
  },
};
