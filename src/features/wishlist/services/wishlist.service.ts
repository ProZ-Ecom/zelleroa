import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { cartService } from "@/features/cart/services/cart.service";
import { wishlistRepository, wishlistItemInclude } from "../repositories/wishlist.repository";
import type { AddWishlistInput } from "../validations/wishlist.schema";
import type {
  CustomerWishlistItemDto,
  CustomerWishlistResponse,
} from "../types/wishlist.types";

async function resolveInternalUser(sessionUserId: string) {
  const user = await userRepository.findById(sessionUserId);
  if (!user || !user.internalId) {
    throw ApiError.unauthorized("User not found or unauthorized");
  }
  if (!user.isActive || user.is_active === false) {
    throw ApiError.accountBlocked("Your account is inactive or blocked. Please contact support.");
  }
  return user;
}

async function validateActiveVariantUnitPrice(identifier: string) {
  let unitPrice = await db.variantUnitPrice.findFirst({
    where: {
      uuid: identifier,
      deleted_at: null,
    },
    include: {
      variant: {
        include: { item: { include: { style: { include: { product: true } } } } },
      },
    },
  });

  if (!unitPrice) {
    // Try looking up by variant UUID
    unitPrice = await db.variantUnitPrice.findFirst({
      where: {
        variant: { uuid: identifier },
        deleted_at: null,
      },
      orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
      include: {
        variant: {
          include: { item: { include: { style: { include: { product: true } } } } },
        },
      },
    });
  }

  if (!unitPrice || unitPrice.deleted_at !== null) {
    throw ApiError.notFound("Product pack size not found");
  }

  const variant = unitPrice.variant;

  if (
    !unitPrice.isActive ||
    !variant ||
    !variant.isActive ||
    variant.deleted_at !== null ||
    !variant.item ||
    !variant.item.isActive ||
    variant.item.deleted_at !== null ||
    !variant.item.style ||
    !variant.item.style.product ||
    !variant.item.style.product.isActive ||
    variant.item.style.product.deleted_at !== null
  ) {
    throw ApiError.badRequest("Product variant is inactive or unavailable");
  }

  return unitPrice;
}

export const wishlistService = {
  async getCustomerWishlist(
    sessionUserId: string
  ): Promise<CustomerWishlistResponse> {
    const user = await resolveInternalUser(sessionUserId);
    return wishlistRepository.findActiveWishlistByUserId(BigInt(user.internalId));
  },

  async addToWishlist(
    sessionUserId: string,
    input: AddWishlistInput
  ): Promise<CustomerWishlistItemDto> {
    const user = await resolveInternalUser(sessionUserId);
    const identifier = input.variantUnitPriceId || input.variantId;
    if (!identifier) {
      throw ApiError.badRequest("Either variantUnitPriceId or variantId is required");
    }

    const unitPrice = await validateActiveVariantUnitPrice(identifier);

    return wishlistRepository.addOrReactivateWishlistItem({
      userId: BigInt(user.internalId),
      productId: unitPrice.variant.item.style.productId,
      styleId: unitPrice.variant.item.styleId,
      itemId: unitPrice.variant.itemId,
      variantId: unitPrice.variant_id,
      variantUnitPriceId: unitPrice.id,
      userInternalId: BigInt(user.internalId),
    });
  },

  async removeFromWishlist(
    sessionUserId: string,
    identifier: string
  ): Promise<void> {
    const user = await resolveInternalUser(sessionUserId);

    // Try finding the active wishlist item directly by wishlistItem uuid, variant_unit_price uuid, or variant uuid
    const wishlistItem = await db.wishlistItem.findFirst({
      where: {
        userId: BigInt(user.internalId),
        is_active: true,
        OR: [
          { uuid: identifier },
          { variant_unit_price: { uuid: identifier } },
          { variant: { uuid: identifier } },
        ],
      },
    });

    if (wishlistItem) {
      await db.wishlistItem.update({
        where: { id: wishlistItem.id },
        data: {
          is_active: false,
          updated_at: new Date(),
          updated_by: BigInt(user.internalId),
        },
      });
      return;
    }

    // Fallback: If not matched directly, try resolving variant_unit_price
    let unitPrice = await db.variantUnitPrice.findFirst({
      where: { uuid: identifier },
    });

    if (!unitPrice) {
      unitPrice = await db.variantUnitPrice.findFirst({
        where: { variant: { uuid: identifier } },
        orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
      });
    }

    if (!unitPrice) {
      throw ApiError.notFound("Product pack size not found");
    }

    const removed = await wishlistRepository.softRemoveWishlistItem(
      BigInt(user.internalId),
      unitPrice.id,
      BigInt(user.internalId)
    );

    if (!removed) {
      throw ApiError.notFound("Item not found in wishlist");
    }
  },

  async moveToCart(sessionUserId: string, identifier: string) {
    const user = await resolveInternalUser(sessionUserId);

    // 1. Find the active wishlist item belonging to this user
    // Supports wishlistItem uuid, variant_unit_price uuid, or variant uuid
    let wishlistItem = await db.wishlistItem.findFirst({
      where: {
        userId: BigInt(user.internalId),
        is_active: true,
        OR: [
          { uuid: identifier },
          { variant_unit_price: { uuid: identifier } },
          { variant: { uuid: identifier } },
        ],
      },
      include: wishlistItemInclude,
      orderBy: { createdAt: "desc" },
    });

    // 2. If wishlistItem wasn't found through user active list, attempt to validate via identifier
    if (!wishlistItem) {
      const unitPrice = await validateActiveVariantUnitPrice(identifier);
      wishlistItem = await wishlistRepository.findWishlistItemByUserAndVariant(
        user.internalId,
        unitPrice.id
      );
    }

    if (!wishlistItem || !wishlistItem.is_active) {
      throw ApiError.notFound("Item not found in wishlist");
    }

    const unitPrice = wishlistItem.variant_unit_price;
    const variant = unitPrice?.variant;
    const product = wishlistItem.product;

    if (
      !unitPrice ||
      !unitPrice.isActive ||
      unitPrice.deleted_at !== null ||
      !variant ||
      !variant.isActive ||
      variant.deleted_at !== null ||
      !product ||
      !product.isActive ||
      product.deleted_at !== null
    ) {
      throw ApiError.badRequest("Product pack size is unavailable or out of stock");
    }

    // 3. Add to active cart with the exact variant pack size
    const cart = await cartService.addItem({ sessionUserId }, {
      variantUnitPriceId: unitPrice.uuid,
      quantity: 1,
    });

    // 4. Soft remove this wishlist item
    await db.wishlistItem.update({
      where: { id: wishlistItem.id },
      data: {
        is_active: false,
        updated_at: new Date(),
        updated_by: BigInt(user.internalId),
      },
    });

    return {
      cart,
      movedVariantUnitPriceId: unitPrice.uuid,
    };
  },

  async getAdminCustomerWishlist(
    customerUuid: string
  ): Promise<CustomerWishlistResponse> {
    const customer = await db.user.findFirst({
      where: {
        uuid: customerUuid,
        deleted_at: null,
        role: {
          slug: "customer",
        },
      },
    });

    if (!customer) {
      throw ApiError.notFound("Customer not found");
    }

    return wishlistRepository.findActiveWishlistByUserId(customer.id);
  },

  async getWishlistCount(sessionUserId: string): Promise<{ count: number }> {
    const user = await resolveInternalUser(sessionUserId);
    const count = await wishlistRepository.getWishlistItemCount(BigInt(user.internalId));
    return { count };
  },
};
