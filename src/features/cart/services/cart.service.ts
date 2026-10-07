import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { formatVariantMeasurement } from "@/features/variants/utils/measurement.util";
import { offerService } from "@/features/offers/services/offer.service";
import { cartRepository, type CartOwner } from "../repositories/cart.repository";
import type {
  AddCartItemInput,
  UpdateCartItemInput,
} from "../validations/cart.schema";
import type {
  CartResponse,
  CartItemResponse,
  CartCountResponse,
} from "../types/cart.types";

/** Who is calling: a real logged-in customer, or a browser identified only by a guest cookie. */
export type CartIdentity = { sessionUserId: string } | { guestSessionId: string };

type DefaultUnitPrice = {
  base_price: unknown;
} | null | undefined;

/**
 * The catalog price of one unit. Offers are applied on top of this by
 * `formatCartResponse`, via the shared offer engine - never here, because a
 * minimum-cart-value offer can only be judged once every line is known.
 */
function calculateVariantPrice(unitPrice: DefaultUnitPrice): number {
  const basePrice =
    unitPrice?.base_price !== null && unitPrice?.base_price !== undefined
      ? Number(unitPrice.base_price)
      : 0;

  return basePrice;
}

const EMPTY_CART: CartResponse = {
  id: null,
  items: [],
  subtotal: 0,
  totalDiscount: 0,
  totalSavings: 0,
  total: 0,
  totalItems: 0,
};

async function formatCartResponse(
  cart: Awaited<ReturnType<typeof cartRepository.findActiveCartByOwner>>
): Promise<CartResponse> {
  if (!cart) return { ...EMPTY_CART };

  type CartRow = (typeof cart.items)[number];
  type PricedCartRow = CartRow & {
    variant_unit_price: NonNullable<CartRow["variant_unit_price"]>;
    product: NonNullable<CartRow["product"]>;
    item: NonNullable<CartRow["item"]>;
  };

  const rows = cart.items.filter(
    (item): item is PricedCartRow =>
      Boolean(item.variant_unit_price) &&
      Boolean(item.product) &&
      Boolean(item.item) &&
      item.is_active
  );

  if (rows.length === 0) {
    return { ...EMPTY_CART, id: cart.uuid || String(cart.id) };
  }

  // One engine call for the whole cart, so offers gated on the cart value see
  // the real subtotal and every line is priced consistently.
  const pricing = await offerService.priceCartItems(
    rows.map((item) => ({
      itemId: item.variant_unit_price.uuid,
      quantity: item.quantity,
      unitPrice: calculateVariantPrice(item.variant_unit_price),
    }))
  );

  let totalItems = 0;

  const items: CartItemResponse[] = rows.map((item, index) => {
    const unitPrice = item.variant_unit_price;
    const variant = unitPrice.variant;
    const product = item.product;
    const cartItem = item.item;
    const line = pricing.lines[index];

    const basePrice = calculateVariantPrice(unitPrice);
    const priceAtAdd = Number(item.price_at_add);
    totalItems += item.quantity;

    const primaryImg =
      variant.product_variant_images?.[0]?.image_url ||
      product.images?.[0]?.image_url ||
      null;

    const measurement = formatVariantMeasurement(
      unitPrice.product_units,
      unitPrice.unit_value ?? 0
    );

    const variantName =
      variant.variant_name ||
      `${unitPrice.unit_value ?? ""} ${unitPrice.product_units?.code || ""}`.trim();

    return {
      id: item.uuid || String(item.id),
      productId: product.uuid || String(product.id),
      styleId: item.style?.uuid || String(item.styleId),
      styleName: item.style?.name || product.name,
      styleSlug: item.style?.slug ?? null,
      itemId: cartItem.uuid || String(cartItem.id),
      variantId: variant.uuid || String(variant.id),
      variantUnitPriceId: unitPrice.uuid || String(unitPrice.id),
      productName: product.name,
      itemName: cartItem.name,
      variantName,
      colorId: variant.color_name ? variant.uuid || String(variant.id) : null,
      colorName: variant.color_name ?? null,
      colorHex: variant.color_hex ?? null,
      colorImage: variant.product_variant_images?.[0]?.image_url ?? null,
      sizeId: unitPrice.attribute_value?.uuid ?? null,
      sizeLabel: unitPrice.attribute_value?.value ?? null,
      measurement,
      primaryImage: primaryImg,
      quantity: item.quantity,
      unitPrice: line.finalPrice,
      price: line.finalPrice,
      priceAtAdd,
      basePrice,
      currentPrice: line.finalPrice,
      // Compared against the catalog price, so an offer starting or ending
      // does not read as "the price of this product changed".
      priceChanged: priceAtAdd !== basePrice,
      discountAmount: line.discountAmount,
      offer: line.offer,
      freeQuantity: line.freeQuantity,
      originalItemTotal: line.originalLineTotal,
      itemTotal: line.finalLineTotal,
    };
  });

  return {
    id: cart.uuid || String(cart.id),
    items,
    subtotal: pricing.subtotal,
    totalDiscount: pricing.totalDiscount,
    totalSavings: pricing.totalSavings,
    total: pricing.total,
    totalItems,
  };
}

async function resolveInternalUserId(sessionUserId: string): Promise<bigint> {
  const user = await userRepository.findById(sessionUserId);
  if (!user) {
    throw ApiError.unauthorized("Please login to access your cart");
  }
  if (!user.isActive || user.is_active === false) {
    throw ApiError.accountBlocked("Your account is inactive or blocked. Please contact support.");
  }
  return BigInt(user.internalId);
}

async function resolveCartOwner(identity: CartIdentity): Promise<CartOwner> {
  if ("sessionUserId" in identity) {
    return { userId: await resolveInternalUserId(identity.sessionUserId) };
  }
  return { sessionId: identity.guestSessionId };
}

export const cartService = {
  async getCart(identity: CartIdentity): Promise<CartResponse> {
    const owner = await resolveCartOwner(identity);
    const cart = await cartRepository.findActiveCartByOwner(owner);
    return formatCartResponse(cart);
  },

  async addItem(
    identity: CartIdentity,
    input: AddCartItemInput
  ): Promise<CartResponse> {
    const owner = await resolveCartOwner(identity);

    // 1. Validate requested variant unit price (exact pack size) & parents
    let unitPrice = input.variantUnitPriceId
      ? await db.variantUnitPrice.findFirst({
          where: {
            uuid: input.variantUnitPriceId,
            deleted_at: null,
          },
          include: {
            variant: { include: { item: { include: { style: { include: { product: true } } } } } },
            inventories: { select: { quantity_available: true } },
          },
        })
      : null;

    // If not found by unit price UUID or variantId was passed directly, try finding by variant UUID
    if (!unitPrice) {
      const variantUuid = input.variantId || input.variantUnitPriceId;
      if (variantUuid) {
        // Try finding default unit price of variant
        unitPrice = await db.variantUnitPrice.findFirst({
          where: {
            variant: { uuid: variantUuid },
            deleted_at: null,
          },
          orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
          include: {
            variant: { include: { item: { include: { style: { include: { product: true } } } } } },
            inventories: { select: { quantity_available: true } },
          },
        });
      }
    }

    if (!unitPrice) {
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
      throw ApiError.badRequest("Product variant is unavailable");
    }

    // Stock is held per exact Color+Size row, so an out-of-stock Red/L is
    // rejected here even when Red/M and Blue/L are both available.
    const available = unitPrice.inventories?.quantity_available ?? 0;
    if (variant.out_of_stock || available <= 0) {
      throw ApiError.badRequest(
        "This colour and size combination is out of stock"
      );
    }
    if (available < input.quantity) {
      throw ApiError.badRequest(
        `Only ${available} left for this colour and size combination`
      );
    }

    const currentPrice = calculateVariantPrice(unitPrice);

    // 2. Add to cart in transaction
    const updatedCart = await cartRepository.addItemToCart({
      owner,
      productId: variant.item.style.productId,
      styleId: variant.item.styleId,
      itemId: variant.itemId,
      variantId: variant.id,
      variantUnitPriceId: unitPrice.id,
      quantity: input.quantity,
      currentPrice,
      adminOrUserId: "userId" in owner ? owner.userId : undefined,
    });

    return formatCartResponse(updatedCart);
  },

  async getCartItem(
    identity: CartIdentity,
    identifier: string
  ): Promise<CartItemResponse> {
    const owner = await resolveCartOwner(identity);

    const item = await cartRepository.findCartItem({
      owner,
      identifier,
    });

    if (!item) {
      throw ApiError.notFound("Cart item not found");
    }

    const unitPrice = item.variant_unit_price;
    const variant = unitPrice?.variant;
    const product = item.product;
    const cartItem = item.item;

    const basePrice = unitPrice
      ? calculateVariantPrice(unitPrice)
      : Number(item.price_at_add);
    const priceAtAdd = Number(item.price_at_add);
    const priceChanged = priceAtAdd !== basePrice;

    // Priced on its own, so the cart-value gate is judged against this line
    // alone; the full-cart view re-prices it against the real subtotal.
    const [line] = unitPrice
      ? await offerService.priceItems(
          [
            {
              itemId: unitPrice.uuid,
              quantity: item.quantity,
              unitPrice: basePrice,
            },
          ],
          { trustUnitPrice: true }
        )
      : [];

    const primaryImg =
      variant?.product_variant_images?.[0]?.image_url ||
      product?.images?.[0]?.image_url ||
      null;

    const measurement = formatVariantMeasurement(
      unitPrice?.product_units,
      unitPrice?.unit_value ?? 0
    );

    const variantName =
      variant?.variant_name ||
      `${unitPrice?.unit_value ?? ""} ${unitPrice?.product_units?.code || ""}`.trim();

    return {
      id: item.uuid || String(item.id),
      productId: product?.uuid || String(item.productId),
      styleId: item.style?.uuid || String(item.styleId),
      styleName: item.style?.name || product?.name || "",
      styleSlug: item.style?.slug ?? null,
      itemId: cartItem?.uuid || String(item.itemId),
      variantId: variant?.uuid || "",
      variantUnitPriceId: unitPrice?.uuid || String(item.variantUnitPriceId),
      productName: product?.name || "",
      itemName: cartItem?.name || "",
      variantName,
      colorId: variant?.color_name ? variant.uuid || String(variant.id) : null,
      colorName: variant?.color_name ?? null,
      colorHex: variant?.color_hex ?? null,
      colorImage: variant?.product_variant_images?.[0]?.image_url ?? null,
      sizeId: unitPrice?.attribute_value?.uuid ?? null,
      sizeLabel: unitPrice?.attribute_value?.value ?? null,
      measurement,
      primaryImage: primaryImg,
      quantity: item.quantity,
      unitPrice: line?.finalPrice ?? basePrice,
      price: line?.finalPrice ?? basePrice,
      priceAtAdd,
      basePrice,
      currentPrice: line?.finalPrice ?? basePrice,
      priceChanged,
      discountAmount: line?.discountAmount ?? 0,
      offer: line?.offer ?? null,
      freeQuantity: line?.freeQuantity ?? 0,
      originalItemTotal: line?.originalLineTotal ?? basePrice * item.quantity,
      itemTotal: line?.finalLineTotal ?? basePrice * item.quantity,
    };
  },

  async updateItemQuantity(
    identity: CartIdentity,
    identifier: string,
    input: UpdateCartItemInput
  ): Promise<CartResponse> {
    const owner = await resolveCartOwner(identity);

    const existingItem = await cartRepository.findCartItem({
      owner,
      identifier,
    });

    if (!existingItem) {
      throw ApiError.notFound("Cart item not found");
    }

    const unitPrice = existingItem.variant_unit_price;
    const variant = unitPrice?.variant;

    if (
      !unitPrice ||
      !unitPrice.isActive ||
      unitPrice.deleted_at !== null ||
      !variant ||
      !variant.isActive ||
      variant.deleted_at !== null ||
      !existingItem.product ||
      !existingItem.product.isActive ||
      existingItem.product.deleted_at !== null
    ) {
      throw ApiError.badRequest("Product variant is unavailable");
    }

    const currentPrice = calculateVariantPrice(unitPrice);

    const updatedCart = await cartRepository.updateItemQuantity({
      owner,
      variantUnitPriceUuid: identifier,
      quantity: input.quantity,
      currentPrice,
      adminOrUserId: "userId" in owner ? owner.userId : undefined,
    });

    if (!updatedCart) {
      throw ApiError.notFound("Cart item not found");
    }

    return formatCartResponse(updatedCart);
  },

  async removeItem(
    identity: CartIdentity,
    identifier: string
  ): Promise<CartResponse> {
    const owner = await resolveCartOwner(identity);

    const updatedCart = await cartRepository.removeCartItem({
      owner,
      variantUnitPriceUuid: identifier,
      adminOrUserId: "userId" in owner ? owner.userId : undefined,
    });

    if (!updatedCart) {
      throw ApiError.notFound("Cart item not found");
    }

    return formatCartResponse(updatedCart);
  },

  async clearCart(identity: CartIdentity): Promise<void> {
    const owner = await resolveCartOwner(identity);
    await cartRepository.clearCart({
      owner,
      adminOrUserId: "userId" in owner ? owner.userId : undefined,
    });
  },

  async getCartCount(identity: CartIdentity): Promise<CartCountResponse> {
    const owner = await resolveCartOwner(identity);
    return cartRepository.getCartItemCount(owner);
  },
};
