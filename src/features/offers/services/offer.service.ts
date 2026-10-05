import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { offerRepository } from "../repositories/offer.repository";
import { priceCart, priceLine, roundMoney } from "./offer-calculation";
import type {
  ApplicableOfferResponse,
  GetOffersParams,
  OfferItemTarget,
  OfferLevel,
  OfferListItem,
  OfferPricingLine,
  OfferPricingResult,
  OfferType,
  SaveOfferInput,
  UpdateOfferInput,
} from "../types";

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

function parseDate(value: Date | string, field: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`${field} is not a valid date`);
  }
  return date;
}

/**
 * Resolve and verify the offer's targets. Nothing gets saved against a
 * product or pack size that has been deleted or never existed, and only the
 * targets matching the chosen level are kept - a leftover selection from the
 * other tab is dropped rather than silently widening the offer.
 */
async function resolveTargets(level: OfferLevel, productIds: string[], itemIds: string[]) {
  if (level === "product") {
    if (productIds.length === 0) {
      throw ApiError.badRequest("A product-wise offer must target at least one product");
    }
    const resolved = await offerRepository.resolveProductIds(productIds);
    if (resolved.missing.length > 0) {
      throw ApiError.badRequest(
        `These products no longer exist: ${resolved.missing.join(", ")}`
      );
    }
    return { productIds: resolved.ids, itemIds: [] as bigint[] };
  }

  if (itemIds.length === 0) {
    throw ApiError.badRequest("An item-wise offer must target at least one item/variant");
  }
  const resolved = await offerRepository.resolveItemIds(itemIds);
  if (resolved.missing.length > 0) {
    throw ApiError.badRequest(
      `These items no longer exist: ${resolved.missing.join(", ")}`
    );
  }
  return { productIds: [] as bigint[], itemIds: resolved.ids };
}

/**
 * A flat discount or special price has to make sense against the real prices
 * of everything the offer covers - the schema can't check this because it
 * needs the catalog.
 */
async function assertDiscountFitsPrices(params: {
  level: OfferLevel;
  type: OfferType;
  value?: number | null;
  productIds: bigint[];
  itemIds: bigint[];
}) {
  if (params.type !== "flat" && params.type !== "special_price") return;
  const numValue = params.value ?? 0;

  const prices =
    params.level === "product"
      ? await offerRepository.findPricesForProducts(params.productIds)
      : await offerRepository.findPricesForItems(params.itemIds);

  if (prices.length === 0) return;

  if (params.type === "flat") {
    const tooCheap = prices.filter((p) => p.basePrice > 0 && numValue >= p.basePrice);
    if (tooCheap.length > 0) {
      const skus = tooCheap.slice(0, 3).map((p) => p.sku).join(", ");
      throw ApiError.badRequest(
        `Discount of ₹${numValue} is not less than the price of ${skus}` +
          (tooCheap.length > 3 ? ` and ${tooCheap.length - 3} more` : "")
      );
    }
    return;
  }

  // A special price above every covered price would never discount anything.
  const anyCheaper = prices.some((p) => p.basePrice > numValue);
  if (!anyCheaper) {
    throw ApiError.badRequest(
      `Special offer price of ₹${numValue} is not below the current price of any selected item`
    );
  }
}

async function warnOnConflicts(params: {
  level: OfferLevel;
  type: OfferType;
  startsAt: Date;
  endsAt: Date;
  productIds: bigint[];
  itemIds: bigint[];
  excludeId?: bigint;
}) {
  const conflicts = await offerRepository.findConflictingOffers(params);
  if (conflicts.length > 0) {
    const names = conflicts.map((c) => c.name).join(", ");
    throw ApiError.conflict(
      `An active offer of the same type and level already covers one of these targets over the same dates: ${names}. ` +
        `Change the dates, the targets, or deactivate the existing offer first.`
    );
  }
}

async function assertCodeIsFree(code: string | null | undefined, excludeUuid?: string) {
  if (!code) return;
  const existing = await offerRepository.findByCode(code, excludeUuid);
  if (existing) {
    throw ApiError.conflict(`Offer code "${code}" is already used by "${existing.name}"`);
  }
}

export const offerService = {
  // -------------------------------------------------------------------------
  // Admin CRUD
  // -------------------------------------------------------------------------

  async getOffers(params: GetOffersParams = {}) {
    return offerRepository.findAll(params);
  },

  async getOffer(uuid: string): Promise<OfferListItem> {
    const offer = await offerRepository.findByUuid(uuid);
    if (!offer) throw ApiError.notFound("Offer not found");
    return offer;
  },

  async createOffer(data: SaveOfferInput, adminEmail?: string): Promise<OfferListItem> {
    const actorId = await getAdminInternalId(adminEmail);
    const startsAt = parseDate(data.startsAt, "Start date");
    const endsAt = parseDate(data.endsAt, "End date");

    if (endsAt.getTime() < startsAt.getTime()) {
      throw ApiError.badRequest("End date cannot be before the start date");
    }

    await assertCodeIsFree(data.code);

    const targets = await resolveTargets(
      data.level,
      data.productIds ?? [],
      data.itemIds ?? []
    );

    await assertDiscountFitsPrices({
      level: data.level,
      type: data.type,
      value: data.value,
      ...targets,
    });

    await warnOnConflicts({
      level: data.level,
      type: data.type,
      startsAt,
      endsAt,
      ...targets,
    });

    return offerRepository.create({
      name: data.name,
      code: data.code ?? null,
      level: data.level,
      type: data.type,
      value: data.value ?? 0,
      buyQuantity: data.type === "bxgy" ? data.buyQuantity ?? null : null,
      getQuantity: data.type === "bxgy" ? data.getQuantity ?? null : null,
      minQuantity: data.minQuantity ?? 1,
      maxQuantity: data.maxQuantity ?? null,
      minCartValue: data.minCartValue ?? null,
      maxDiscountAmount: data.type === "special_price" ? null : data.maxDiscountAmount ?? null,
      priority: data.priority ?? 0,
      terms: data.terms ?? null,
      startsAt,
      endsAt,
      isActive: data.isActive ?? true,
      productIds: targets.productIds,
      itemIds: targets.itemIds,
      actorId,
    });
  },

  async updateOffer(
    uuid: string,
    data: UpdateOfferInput,
    adminEmail?: string
  ): Promise<OfferListItem> {
    const existing = await offerRepository.findByUuid(uuid);
    if (!existing) throw ApiError.notFound("Offer not found");

    const id = await offerRepository.findInternalIdByUuid(uuid);
    if (!id) throw ApiError.notFound("Offer not found");

    const actorId = await getAdminInternalId(adminEmail);

    // Every rule below is checked against the offer as it will be *after* the
    // patch, so a partial update can't leave an invalid combination behind.
    const level = data.level ?? existing.level;
    const type = data.type ?? existing.type;
    const value = data.value !== undefined ? (data.value ?? 0) : existing.value;
    const startsAt = data.startsAt
      ? parseDate(data.startsAt, "Start date")
      : existing.startsAt
        ? new Date(existing.startsAt)
        : new Date();
    const endsAt = data.endsAt
      ? parseDate(data.endsAt, "End date")
      : existing.endsAt
        ? new Date(existing.endsAt)
        : startsAt;

    if (endsAt.getTime() < startsAt.getTime()) {
      throw ApiError.badRequest("End date cannot be before the start date");
    }

    if (data.code !== undefined) {
      await assertCodeIsFree(data.code, uuid);
    }

    // Switching level requires the targets for the new level; otherwise reuse
    // whatever the offer already points at.
    const productIds =
      data.productIds ?? (level === "product" ? existing.products.map((p) => p.id) : []);
    const itemIds = data.itemIds ?? (level === "item" ? existing.items.map((i) => i.id) : []);

    const targets = await resolveTargets(level, productIds, itemIds);

    await assertDiscountFitsPrices({ level, type, value, ...targets });

    await warnOnConflicts({
      level,
      type,
      startsAt,
      endsAt,
      ...targets,
      excludeId: id,
    });

    return offerRepository.update(id, {
      name: data.name,
      code: data.code,
      level,
      type,
      value: data.value !== undefined ? (data.value ?? 0) : undefined,
      buyQuantity: type === "bxgy" ? data.buyQuantity ?? existing.buyQuantity : null,
      getQuantity: type === "bxgy" ? data.getQuantity ?? existing.getQuantity : null,
      minQuantity: data.minQuantity,
      maxQuantity: data.maxQuantity,
      minCartValue: data.minCartValue,
      maxDiscountAmount:
        type === "special_price" ? null : data.maxDiscountAmount,
      priority: data.priority,
      terms: data.terms,
      startsAt,
      endsAt,
      isActive: data.isActive,
      productIds: targets.productIds,
      itemIds: targets.itemIds,
      actorId,
    });
  },

  async setOfferStatus(uuid: string, isActive: boolean, adminEmail?: string) {
    const id = await offerRepository.findInternalIdByUuid(uuid);
    if (!id) throw ApiError.notFound("Offer not found");
    const actorId = await getAdminInternalId(adminEmail);
    return offerRepository.setStatus(id, isActive, actorId);
  },

  async deleteOffer(uuid: string, adminEmail?: string) {
    const id = await offerRepository.findInternalIdByUuid(uuid);
    if (!id) throw ApiError.notFound("Offer not found");
    const actorId = await getAdminInternalId(adminEmail);
    await offerRepository.softDelete(id, actorId);
    return null;
  },

  // -------------------------------------------------------------------------
  // Target pickers
  // -------------------------------------------------------------------------

  async getSelectableProducts(params: {
    categoryId?: string;
    search?: string;
    limit?: number;
  }) {
    return offerRepository.findSelectableProducts({
      categoryId: params.categoryId,
      search: params.search,
      limit: params.limit ?? 50,
    });
  },

  async getSelectableItems(params: {
    productId?: string;
    categoryId?: string;
    search?: string;
    limit?: number;
  }): Promise<OfferItemTarget[]> {
    if (!params.productId && !params.categoryId && !params.search) {
      // Without a parent selection the list would be the whole catalog; the
      // admin picks a product first.
      return [];
    }
    return offerRepository.findSelectableItems({
      productId: params.productId,
      categoryId: params.categoryId,
      search: params.search,
      limit: params.limit ?? 50,
    });
  },

  // -------------------------------------------------------------------------
  // Customer-facing offer resolution
  //
  // These are the only entry points other features should use. The backend is
  // the final authority on price: nothing here trusts a discount, a final
  // price or an offer id supplied by the client.
  // -------------------------------------------------------------------------

  async getOffersForProduct(productUuid: string, activeOnly = true) {
    return offerRepository.findOffersByProductUuid(productUuid, activeOnly);
  },

  async getOffersForItem(itemUuid: string, activeOnly = true) {
    return offerRepository.findOffersByItemUuid(itemUuid, activeOnly);
  },

  /**
   * Price a set of lines. Unit prices are re-read from the catalog, so a
   * caller that passes a tampered price gets the real one back.
   */
  async priceItems(
    lines: Array<{ itemId: string; quantity: number; unitPrice?: number }>,
    options: { cartValue?: number; trustUnitPrice?: boolean } = {}
  ): Promise<OfferPricingResult[]> {
    if (lines.length === 0) return [];

    const itemIds = lines.map((l) => l.itemId);
    const [offersByItem, priceByItem] = await Promise.all([
      offerRepository.findApplicableOffersByItemUuids(itemIds),
      options.trustUnitPrice
        ? Promise.resolve(null)
        : offerRepository.findItemPricesByUuids(itemIds),
    ]);

    const pricingLines: OfferPricingLine[] = lines.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      unitPrice: priceByItem
        ? priceByItem.get(line.itemId)?.unitPrice ?? line.unitPrice ?? 0
        : line.unitPrice ?? 0,
      productId: priceByItem?.get(line.itemId)?.productId,
    }));

    return priceCart(pricingLines, offersByItem, { cartValue: options.cartValue }).lines;
  },

  /**
   * Price a whole cart in one pass, including the subtotal, the total
   * discount and the shopper's total savings.
   */
  async priceCartItems(
    lines: Array<{ itemId: string; quantity: number; unitPrice: number }>
  ) {
    if (lines.length === 0) {
      return { lines: [], subtotal: 0, totalDiscount: 0, total: 0, totalSavings: 0 };
    }
    const offersByItem = await offerRepository.findApplicableOffersByItemUuids(
      lines.map((l) => l.itemId)
    );
    return priceCart(lines, offersByItem);
  },

  /**
   * The best valid offer for one pack size at a given quantity - what
   * `GET /offers/applicable/:itemId` returns.
   */
  async getApplicableOffer(
    itemUuid: string,
    options: { quantity?: number; cartValue?: number } = {}
  ): Promise<ApplicableOfferResponse> {
    const prices = await offerRepository.findItemPricesByUuids([itemUuid]);
    const price = prices.get(itemUuid);
    if (!price) throw ApiError.notFound("Item not found");

    const quantity = Math.max(1, options.quantity ?? 1);
    const offers = await offerRepository.findApplicableOffersByItemUuids([itemUuid]);

    const result = priceLine(offers.get(itemUuid) ?? [], {
      itemId: itemUuid,
      unitPrice: price.unitPrice,
      quantity,
      productId: price.productId,
    }, { cartValue: options.cartValue });

    return {
      itemId: itemUuid,
      originalPrice: result.originalPrice,
      offerApplied: result.offerApplied,
      offer: result.offer,
      // Reported for the requested quantity, so a quantity-gated offer is
      // visible for exactly the quantity that unlocks it.
      discountAmount: result.discountAmount,
      finalPrice: result.finalPrice,
    };
  },

  /**
   * Map of pack-size UUID to its best single-unit price, for decorating a
   * product listing. One round trip regardless of how many items are shown.
   */
  async getBestUnitPrices(
    items: Array<{ itemId: string; unitPrice: number }>
  ): Promise<Map<string, OfferPricingResult>> {
    const result = new Map<string, OfferPricingResult>();
    if (items.length === 0) return result;

    const offersByItem = await offerRepository.findApplicableOffersByItemUuids(
      items.map((i) => i.itemId)
    );

    for (const item of items) {
      result.set(
        item.itemId,
        priceLine(offersByItem.get(item.itemId) ?? [], {
          itemId: item.itemId,
          unitPrice: item.unitPrice,
          // Listing prices are quoted per unit. A quantity-gated offer will
          // not show here, and is applied once the cart reaches its minimum.
          quantity: 1,
        })
      );
    }

    return result;
  },

  /**
   * Total offer discount for a set of cart lines. Kept as a single number for
   * callers that only need the money off (order totals, checkout summary).
   */
  async calculateCartDiscount(
    items: Array<{ itemId: string; quantity: number; unitPrice: number }>
  ): Promise<number> {
    if (items.length === 0) return 0;
    const priced = await this.priceCartItems(items);
    return roundMoney(priced.totalDiscount);
  },
};
