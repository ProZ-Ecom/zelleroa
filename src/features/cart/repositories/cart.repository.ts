import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { ApiError } from "@/lib/api/api-error";
import { reservationService } from "@/features/inventory/services/reservation.service";

/** A cart belongs either to a real customer or, before checkout, to an anonymous browser session. */
export type CartOwner = { userId: bigint } | { sessionId: string };

function ownerWhere(owner: CartOwner): Prisma.CartWhereInput {
  return "userId" in owner ? { userId: owner.userId } : { sessionId: owner.sessionId };
}

function ownerCreateData(owner: CartOwner): Pick<Prisma.CartUncheckedCreateInput, "userId" | "sessionId"> {
  return "userId" in owner ? { userId: owner.userId } : { sessionId: owner.sessionId };
}

export const cartItemInclude = Prisma.validator<Prisma.CartItemInclude>()({
  product: {
    select: {
      id: true,
      uuid: true,
      name: true,
      isActive: true,
      deleted_at: true,
      images: {
        where: { is_active: true },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
    },
  },
  // The Style the line was bought under - the unit the storefront lists and
  // links to, so the cart can name it and link back to its detail page.
  style: {
    select: {
      id: true,
      uuid: true,
      name: true,
      slug: true,
    },
  },
  variant_unit_price: {
    select: {
      id: true,
      uuid: true,
      sku: true,
      base_price: true,
      unit_value: true,
      is_default: true,
      isActive: true,
      deleted_at: true,
      // The exact Size this line sells, when the Color was split by Size.
      attribute_value: {
        select: { id: true, uuid: true, value: true },
      },
      inventories: {
        select: { quantity_available: true },
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
          color_name: true,
          color_hex: true,
          isActive: true,
          deleted_at: true,
          product_variant_images: {
            where: { is_active: true },
            orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
            take: 1,
          },
        },
      },
    },
  },
});

export const cartInclude = Prisma.validator<Prisma.CartInclude>()({
  items: {
    where: {
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
    include: cartItemInclude,
    orderBy: { createdAt: "desc" },
  },
});

export const cartRepository = {
  async findActiveCartByOwner(owner: CartOwner) {
    return db.cart.findFirst({
      where: {
        ...ownerWhere(owner),
        status: "active",
        is_active: true,
      },
      include: cartInclude,
    });
  },

  async getOrCreateActiveCart(
    owner: CartOwner,
    adminOrUserId?: bigint,
    prismaClient: Prisma.TransactionClient | typeof db = db
  ) {
    const existing = await prismaClient.cart.findFirst({
      where: {
        ...ownerWhere(owner),
        status: "active",
        is_active: true,
      },
      include: cartInclude,
    });

    if (existing) {
      return existing;
    }

    return prismaClient.cart.create({
      data: {
        uuid: crypto.randomUUID(),
        ...ownerCreateData(owner),
        status: "active",
        is_active: true,
        last_activity_at: new Date(),
        created_by: adminOrUserId,
        updated_by: adminOrUserId,
      },
      include: cartInclude,
    });
  },

  async addItemToCart(params: {
    owner: CartOwner;
    productId: bigint;
    styleId: bigint;
    itemId?: bigint | null;
    variantId: bigint;
    variantUnitPriceId?: bigint | null;
    quantity: number;
    currentPrice: number;
    adminOrUserId?: bigint;
  }) {
    return db.$transaction(async (tx) => {
      // 1. Get or create active cart
      const cart = await this.getOrCreateActiveCart(
        params.owner,
        params.adminOrUserId,
        tx
      );

      // 2. Check if item exists in this cart (active or inactive)
      const existingItem = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          styleId: params.styleId,
          variantId: params.variantId,
          ...(params.variantUnitPriceId ? { variantUnitPriceId: params.variantUnitPriceId } : {}),
        },
      });

      if (existingItem) {
        // If already active, increase quantity. If inactive, reactivate with requested quantity.
        const newQuantity = existingItem.is_active
          ? existingItem.quantity + params.quantity
          : params.quantity;

        if (params.variantUnitPriceId) {
          await reservationService.checkAndReserve(tx, {
            variantUnitPriceId: params.variantUnitPriceId,
            cartId: cart.id,
            quantity: newQuantity,
          });
        }

        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQuantity,
            price_at_add: params.currentPrice,
            is_active: true,
            updatedAt: new Date(),
            updated_by: params.adminOrUserId,
          },
        });
      } else {
        if (params.variantUnitPriceId) {
          await reservationService.checkAndReserve(tx, {
            variantUnitPriceId: params.variantUnitPriceId,
            cartId: cart.id,
            quantity: params.quantity,
          });
        }

        // Create new item
        await tx.cartItem.create({
          data: {
            uuid: crypto.randomUUID(),
            cartId: cart.id,
            productId: params.productId,
            styleId: params.styleId,
            variantId: params.variantId,
            variantUnitPriceId: params.variantUnitPriceId ?? null,
            quantity: params.quantity,
            price_at_add: params.currentPrice,
            is_active: true,
            created_by: params.adminOrUserId,
            updated_by: params.adminOrUserId,
          },
        });
      }

      // 3. Update cart last_activity_at
      await tx.cart.update({
        where: { id: cart.id },
        data: {
          last_activity_at: new Date(),
          updatedAt: new Date(),
          updated_by: params.adminOrUserId,
        },
      });

      // 4. Return updated cart with all active items
      return tx.cart.findUniqueOrThrow({
        where: { id: cart.id },
        include: cartInclude,
      });
    });
  },

  async findCartItem(params: { owner: CartOwner; identifier: string }) {
    const cart = await db.cart.findFirst({
      where: {
        ...ownerWhere(params.owner),
        status: "active",
        is_active: true,
      },
    });

    if (!cart) return null;

    return db.cartItem.findFirst({
      where: {
        cartId: cart.id,
        is_active: true,
        OR: [
          { uuid: params.identifier },
          { variant_unit_price: { uuid: params.identifier } },
          { variant_unit_price: { variant: { uuid: params.identifier } } },
        ],
      },
      include: cartItemInclude,
    });
  },

  async updateItemQuantity(params: {
    owner: CartOwner;
    variantUnitPriceUuid: string;
    quantity: number;
    currentPrice?: number;
    adminOrUserId?: bigint;
  }) {
    return db.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: {
          ...ownerWhere(params.owner),
          status: "active",
          is_active: true,
        },
      });

      if (!cart) return null;

      const item = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          is_active: true,
          OR: [
            { uuid: params.variantUnitPriceUuid },
            { variant_unit_price: { uuid: params.variantUnitPriceUuid } },
            { variant_unit_price: { variant: { uuid: params.variantUnitPriceUuid } } },
          ],
        },
        include: {
          variant_unit_price: {
            include: { inventories: { select: { quantity_available: true } } },
          },
        },
      });

      if (!item) return null;

      if (item.variant_unit_price) {
        await reservationService.checkAndReserve(tx, {
          variantUnitPriceId: item.variant_unit_price.id,
          cartId: cart.id,
          quantity: params.quantity,
        });
      }

      const price =
        params.currentPrice ??
        (item.variant_unit_price
          ? Number(item.variant_unit_price.base_price)
          : Number(item.price_at_add));

      await tx.cartItem.update({
        where: { id: item.id },
        data: {
          quantity: params.quantity,
          price_at_add: price,
          updatedAt: new Date(),
          updated_by: params.adminOrUserId,
        },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: {
          last_activity_at: new Date(),
          updatedAt: new Date(),
          updated_by: params.adminOrUserId,
        },
      });

      return tx.cart.findUniqueOrThrow({
        where: { id: cart.id },
        include: cartInclude,
      });
    });
  },

  async removeCartItem(params: {
    owner: CartOwner;
    variantUnitPriceUuid: string;
    adminOrUserId?: bigint;
  }) {
    return db.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: {
          ...ownerWhere(params.owner),
          status: "active",
          is_active: true,
        },
      });

      if (!cart) return null;

      const item = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          is_active: true,
          OR: [
            { uuid: params.variantUnitPriceUuid },
            { variant_unit_price: { uuid: params.variantUnitPriceUuid } },
            { variant_unit_price: { variant: { uuid: params.variantUnitPriceUuid } } },
          ],
        },
      });

      if (!item) return null;

      if (item.variantUnitPriceId) {
        await reservationService.checkAndReserve(tx, {
          variantUnitPriceId: item.variantUnitPriceId,
          cartId: cart.id,
          quantity: 0,
        });
      }

      await tx.cartItem.update({
        where: { id: item.id },
        data: {
          is_active: false,
          updatedAt: new Date(),
          updated_by: params.adminOrUserId,
        },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: {
          last_activity_at: new Date(),
          updatedAt: new Date(),
          updated_by: params.adminOrUserId,
        },
      });

      return tx.cart.findUniqueOrThrow({
        where: { id: cart.id },
        include: cartInclude,
      });
    });
  },

  async clearCart(params: {
    owner: CartOwner;
    adminOrUserId?: bigint;
  }) {
    return db.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: {
          ...ownerWhere(params.owner),
          status: "active",
          is_active: true,
        },
      });

      if (!cart) return true;

      await reservationService.releaseCart(tx, cart.id);

      await tx.cartItem.updateMany({
        where: {
          cartId: cart.id,
          is_active: true,
        },
        data: {
          is_active: false,
          updatedAt: new Date(),
          updated_by: params.adminOrUserId,
        },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: {
          last_activity_at: new Date(),
          updatedAt: new Date(),
          updated_by: params.adminOrUserId,
        },
      });

      return true;
    });
  },

  async getCartItemCount(
    owner: CartOwner
  ): Promise<{ count: number; totalQuantity: number }> {
    const cart = await db.cart.findFirst({
      where: {
        ...ownerWhere(owner),
        status: "active",
        is_active: true,
      },
      select: { id: true },
    });

    if (!cart) return { count: 0, totalQuantity: 0 };

    const result = await db.cartItem.aggregate({
      where: {
        cartId: cart.id,
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
      _count: {
        id: true,
      },
      _sum: {
        quantity: true,
      },
    });

    return {
      count: result._count.id ?? 0,
      totalQuantity: result._sum.quantity ?? 0,
    };
  },

  /** Hands a guest's session-based cart over to the (shadow) user account created for their order. */
  async claimGuestCart(sessionId: string, userId: bigint) {
    return db.cart.updateMany({
      where: { sessionId, status: "active", is_active: true },
      data: { userId, sessionId: null, updatedAt: new Date() },
    });
  },
};
