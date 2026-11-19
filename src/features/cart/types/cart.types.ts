import type { VariantMeasurement } from "@/features/variants/utils/measurement.util";
import type { OfferBreakdown } from "@/features/offers/types";

export type { VariantMeasurement };

export interface CartItemResponse {
  id: string; // Public Cart Item UUID
  productId: string; // Public Product UUID
  /** Public Style UUID - the unit the storefront lists and links to. */
  styleId: string;
  styleName: string;
  styleSlug: string | null;
  variantId: string; // Public Variant UUID (Color level)
  variantUnitPriceId: string; // Public Variant Unit Price UUID (Size/pack)
  productName: string;
  variantName: string;
  /**
   * The exact Color + Size this line sells. A cart line is keyed by the
   * Color+Size combination, not the Style, so Red/M and Red/L are separate
   * lines with their own price, stock and image.
   */
  colorId: string | null; // Public Variant UUID, null when the Style has no Color split
  colorName: string | null;
  colorHex: string | null;
  colorImage: string | null;
  sizeId: string | null; // Public AttributeValue UUID
  sizeLabel: string | null;
  measurement: VariantMeasurement;
  primaryImage: string | null;
  quantity: number;
  /** What one unit costs for this exact Color+Size, after offers. */
  unitPrice: number;
  /** Alias of `currentPrice`, kept for callers that read `price`. */
  price?: number;
  /** Catalog price captured when the item was added to the cart. */
  priceAtAdd: number;
  /** Today's catalog price per unit, before any offer. */
  basePrice: number;
  /** What one unit actually costs after the best applicable offer. */
  currentPrice: number;
  /** True when the catalog price moved since the item was added. */
  priceChanged: boolean;
  /** Money the offer takes off this line, across all its units. */
  discountAmount: number;
  /** The offer that won for this line, or null when none applies. */
  offer: OfferBreakdown | null;
  /** Free units earned by a Buy X Get Y offer. */
  freeQuantity: number;
  /** Line total at the catalog price, before the offer. */
  originalItemTotal: number;
  /** Line total the customer pays, after the offer. */
  itemTotal: number;
}

export interface CartResponse {
  id: string | null; // Public Cart UUID
  items: CartItemResponse[];
  /** Sum of the lines at catalog prices, before offers. */
  subtotal: number;
  /** Total offer discount across the cart. */
  totalDiscount: number;
  /** Same figure, named for the "you saved" line in the UI. */
  totalSavings: number;
  /** Subtotal minus the discount; delivery and tax are added at checkout. */
  total: number;
  totalItems: number;
}

export type CartWithItems = CartResponse;

export interface CartCountResponse {
  count: number;
  totalQuantity: number;
}

export interface CartSummaryData {
  subtotal: number;
  discount: number;
  tax: number;
  shippingCharge: number;
  grandTotal: number;
  totalItems: number;
}

export type CartSummaryType = CartSummaryData;

export interface AddToCartInput {
  variantId?: string;
  variantUnitPriceId?: string;
  productId?: number | string;
  quantity?: number;
}

export type { UpdateCartItemInput } from "../validations/cart.schema";

