import { offerService } from "@/features/offers/services/offer.service";
import type { OfferBreakdown } from "@/features/offers/types";
import type {
  CustomerProductDetailDto,
  CustomerProductListItemDto,
  CustomerRelatedVariantDto,
  CustomerVariantDetailDto,
  CustomerVariantListItemDto,
  CustomerStyleDetailDto,
} from "../types/catalog.types";

/**
 * The catalog repository reads base prices only - `computeSellingPrice` there
 * is deliberately a pass-through. This module is the one place that turns
 * those base prices into what the shopper is actually charged, by running the
 * shared offer engine over a whole page of results in a single round trip.
 *
 * It mutates the DTOs in place because it runs on freshly built objects that
 * have not yet left the service layer.
 */

/** Any pack-size row the storefront renders a price for. */
interface PricedUnitPrice {
  id: string;
  basePrice: number;
  sellingPrice: number;
  offer?: OfferBreakdown | null;
  discountAmount?: number;
  discountPercent?: number;
}

async function applyOffers(rows: PricedUnitPrice[]): Promise<void> {
  const priceable = rows.filter((row) => row.id && row.basePrice > 0);
  if (priceable.length === 0) return;

  const pricing = await offerService.getBestUnitPrices(
    priceable.map((row) => ({ itemId: row.id, unitPrice: row.basePrice }))
  );

  for (const row of priceable) {
    const result = pricing.get(row.id);
    if (!result || !result.offerApplied) {
      row.sellingPrice = row.basePrice;
      row.offer = null;
      row.discountAmount = 0;
      row.discountPercent = 0;
      continue;
    }
    row.sellingPrice = result.finalPrice;
    row.offer = result.offer;
    row.discountAmount = result.discountAmount;
    row.discountPercent = result.discountPercent;
  }
}

/**
 * `salePrice` and `measurement` on a variant mirror its default pack size, so
 * they have to be re-synced after the pack sizes are discounted.
 */
function syncVariantHeadlinePrice(variant: CustomerVariantListItemDto): void {
  const defaultUnitPrice =
    variant.unitPrices.find((up) => up.isDefault) ?? variant.unitPrices[0] ?? null;
  if (!defaultUnitPrice) return;
  variant.basePrice = defaultUnitPrice.basePrice;
  variant.salePrice = defaultUnitPrice.sellingPrice;
}

export const catalogOffers = {
  async decorateProducts(
    products: CustomerProductListItemDto[]
  ): Promise<CustomerProductListItemDto[]> {
    await applyOffers(products.flatMap((product) => product.unitPrices ?? []));

    // `minPrice`/`maxPrice` drive the listing's price range and its sorting,
    // so they have to follow the discounted prices, not the base ones.
    for (const product of products) {
      const prices = (product.unitPrices ?? []).map((up) => up.sellingPrice);
      if (prices.length > 0) {
        product.minPrice = Math.min(...prices);
        product.maxPrice = Math.max(...prices);
      }
    }

    return products;
  },

  async decorateVariants(
    variants: CustomerVariantListItemDto[]
  ): Promise<CustomerVariantListItemDto[]> {
    await applyOffers(variants.flatMap((variant) => variant.unitPrices));
    variants.forEach(syncVariantHeadlinePrice);
    return variants;
  },

  async decorateVariant<T extends CustomerVariantListItemDto | CustomerVariantDetailDto>(
    variant: T
  ): Promise<T> {
    await this.decorateVariants([variant]);
    return variant;
  },

  /**
   * The Style detail page prices every Color's every Size in one pass, then
   * re-derives the Style's price range from the discounted prices so the
   * "from ₹x" figure matches what the size chips actually charge.
   */
  async decorateStyleDetail(style: CustomerStyleDetailDto): Promise<CustomerStyleDetailDto> {
    await this.decorateVariants(style.colors);

    const prices = style.colors.flatMap((color) =>
      color.unitPrices.map((up) => up.sellingPrice)
    );
    if (prices.length > 0) {
      style.minPrice = Math.min(...prices);
      style.maxPrice = Math.max(...prices);
    }

    return style;
  },

  async decorateProductDetail(
    product: CustomerProductDetailDto
  ): Promise<CustomerProductDetailDto> {
    await this.decorateVariants(product.styles.flatMap((style) => style.variants));
    return product;
  },

  /**
   * Related rows carry a single representative price rather than a list of
   * pack sizes, so they are priced by the pack size their `sku` refers to.
   */
  async decorateRelatedVariants(
    items: CustomerRelatedVariantDto[]
  ): Promise<CustomerRelatedVariantDto[]> {
    const priceable = items.filter((item) => item.unitPriceId && item.price > 0);
    if (priceable.length === 0) return items;

    const pricing = await offerService.getBestUnitPrices(
      priceable.map((item) => ({ itemId: item.unitPriceId!, unitPrice: item.price }))
    );

    for (const item of priceable) {
      const result = pricing.get(item.unitPriceId!);
      item.offerPrice = result?.offerApplied ? result.finalPrice : null;
    }

    return items;
  },
};
