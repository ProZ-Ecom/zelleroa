import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { formatVariantMeasurement } from "@/features/variants/utils/measurement.util";
import type {
  CustomerWishlistItemDto,
  CustomerWishlistResponse,
} from "../types/wishlist.types";

export const wishlistItemInclude = Prisma.validator<Prisma.WishlistItemInclude>()({
  product: {
    select: {
      id: true,
      uuid: true,
      name: true,
      slug: true,
      isActive: true,
      deleted_at: true,
      images: {
        where: { is_active: true },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: { image_url: true },
      },
    },
  },
  style: {
    select: {
      id: true,
      uuid: true,
      name: true,
      slug: true,
      isActive: true,
      deleted_at: true,
      out_of_stock: true,
    },
  },
  variant_unit_price: {
    select: {
      id: true,
      uuid: true,
      sku: true,
      base_price: true,
      unit_value: true,
      isActive: true,
      deleted_at: true,
      inventories: {
        select: {
          quantity_available: true,
          quantity_reserved: true,
        },
      },
      product_units: {
        select: {
          id: true,
          uuid: true,
          name: true,
          code: true,
          type: true,
        },
      },
      variant: {
        select: {
          id: true,
          uuid: true,
          variant_name: true,
          isActive: true,
          deleted_at: true,
          out_of_stock: true,
          style: {
            select: {
              id: true,
              uuid: true,
              name: true,
              slug: true,
              isActive: true,
              deleted_at: true,
              out_of_stock: true,
            },
          },
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
});

export function formatWishlistItem(
  item: Prisma.WishlistItemGetPayload<{ include: typeof wishlistItemInclude }>
): CustomerWishlistItemDto | null {
  const unitPrice = item.variant_unit_price;
  const variant = unitPrice?.variant;
  const product = item.product;
  if (!unitPrice || !variant || !product) return null;

  const style = item.style || variant.style;
  const styleName = style?.name || null;

  // Selling price is computed on the frontend from basePrice minus any
  // active offer/discount; salePrice is mirrored here for backward-compat
  // consumers only.
  const salePrice: number | null = null;
  const basePrice = Number(unitPrice.base_price);
  const livePrice = salePrice ?? basePrice;

  const primaryImage =
    variant.product_variant_images?.[0]?.image_url ||
    product.images?.[0]?.image_url ||
    null;

  const measurement = formatVariantMeasurement(
    unitPrice.product_units,
    unitPrice.unit_value ?? 0
  );

  const isRecordActive =
    Boolean(unitPrice.isActive) &&
    unitPrice.deleted_at === null &&
    Boolean(variant.isActive) &&
    variant.deleted_at === null &&
    Boolean(product.isActive) &&
    product.deleted_at === null &&
    (!style || (Boolean(style.isActive) && style.deleted_at === null));

  const inv = unitPrice.inventories;
  const stockAvailable = inv
    ? Math.max(0, (inv.quantity_available ?? 0) - (inv.quantity_reserved ?? 0))
    : 0;

  const isOutOfStock =
    Boolean(variant.out_of_stock) ||
    Boolean(style?.out_of_stock) ||
    stockAvailable <= 0;

  const isAvailable = isRecordActive && !isOutOfStock;

  return {
    id: item.uuid || String(item.id),
    variantId: variant.uuid || String(variant.id),
    variantUnitPriceId: unitPrice.uuid || String(unitPrice.id),
    variantName: variant.variant_name,
    styleName,
    style: style
      ? {
          id: style.uuid || String(style.id),
          name: style.name,
          slug: style.slug,
        }
      : null,
    sku: unitPrice.sku ?? "",
    price: livePrice,
    basePrice,
    salePrice,
    measurement,
    primaryImage,
    isAvailable,
    product: {
      id: product.uuid || String(product.id),
      name: product.name,
      slug: product.slug,
    },
    createdAt: item.createdAt,
  };
}

export const wishlistRepository = {
  async findActiveWishlistByUserId(
    userId: bigint
  ): Promise<CustomerWishlistResponse> {
    const items = await db.wishlistItem.findMany({
      where: {
        userId,
        is_active: true,
      },
      include: wishlistItemInclude,
      orderBy: { createdAt: "desc" },
    });

    const formattedItems: CustomerWishlistItemDto[] = [];
    for (const item of items) {
      const formatted = formatWishlistItem(item);
      if (formatted) {
        formattedItems.push(formatted);
      }
    }

    return {
      items: formattedItems,
      totalItems: formattedItems.length,
    };
  },

  async findWishlistItemByUserAndVariant(
    userId: bigint,
    variantUnitPriceId: bigint
  ) {
    return db.wishlistItem.findFirst({
      where: {
        userId,
        variant_unit_price_id: variantUnitPriceId,
      },
      include: wishlistItemInclude,
    });
  },

  async addOrReactivateWishlistItem(params: {
    userId: bigint;
    productId: bigint;
    styleId?: bigint | null;
    variantId?: bigint | null;
    variantUnitPriceId: bigint;
    userInternalId: bigint;
  }): Promise<CustomerWishlistItemDto> {
    const existing = await db.wishlistItem.findFirst({
      where: {
        userId: params.userId,
        productId: params.productId,
        ...(params.variantId ? { variantId: params.variantId } : {}),
      },
      include: wishlistItemInclude,
    });

    if (existing) {
      const updated = await db.wishlistItem.update({
        where: { id: existing.id },
        data: {
          is_active: true,
          styleId: params.styleId ?? existing.styleId,
          variantId: params.variantId ?? existing.variantId,
          variant_unit_price_id: params.variantUnitPriceId,
          updated_at: new Date(),
          updated_by: params.userInternalId,
        },
        include: wishlistItemInclude,
      });
      const formatted = formatWishlistItem(updated);
      if (!formatted) throw new Error("Failed to format wishlist item");
      return formatted;
    }

    const created = await db.wishlistItem.create({
      data: {
        uuid: crypto.randomUUID(),
        userId: params.userId,
        productId: params.productId,
        styleId: params.styleId ?? null,
        variantId: params.variantId ?? null,
        variant_unit_price_id: params.variantUnitPriceId,
        is_active: true,
        created_by: params.userInternalId,
        updated_by: params.userInternalId,
      },
      include: wishlistItemInclude,
    });

    const formatted = formatWishlistItem(created);
    if (!formatted) throw new Error("Failed to format wishlist item");
    return formatted;
  },

  async softRemoveWishlistItem(
    userId: bigint,
    variantUnitPriceId: bigint,
    userInternalId?: bigint
  ): Promise<boolean> {
    const existing = await db.wishlistItem.findFirst({
      where: {
        userId,
        variant_unit_price_id: variantUnitPriceId,
        is_active: true,
      },
    });

    if (!existing) return false;

    await db.wishlistItem.update({
      where: { id: existing.id },
      data: {
        is_active: false,
        updated_at: new Date(),
        updated_by: userInternalId ?? userId,
      },
    });

    return true;
  },

  async getWishlistItemCount(userId: bigint): Promise<number> {
    return db.wishlistItem.count({
      where: {
        userId,
        is_active: true,
        variant_unit_price: {
          isActive: true,
          deleted_at: null,
          variant: {
            isActive: true,
            deleted_at: null,
          },
        },
        product: {
          isActive: true,
          deleted_at: null,
        },
      },
    });
  },
};
