import type { VariantMeasurement } from "@/features/variants/utils/measurement.util";

/**
 * How wide an offer casts its net.
 * - `product`: every sellable pack size under the product (all items/variants).
 * - `item`: only the pack sizes the admin explicitly picked.
 */
export type OfferLevel = "product" | "item";

/**
 * Stored as the `offers.type` enum.
 * - `percentage`   - N% off the base price.
 * - `flat`         - a fixed rupee amount off each unit.
 * - `special_price` - the item sells at exactly this price.
 * - `bxgy`         - buy X units, get Y of them free.
 */
export type OfferType = "percentage" | "flat" | "special_price" | "bxgy";

export type OfferStatusFilter = "active" | "inactive" | "scheduled" | "expired";

/** Derived from the date window + `isActive`; never stored. */
export type OfferComputedStatus = "active" | "inactive" | "scheduled" | "expired";

export interface OfferProductTarget {
  id: string; // Product UUID
  name: string;
  categoryId: string | null; // Category UUID
  categoryName: string | null;
}

export interface OfferItemTarget {
  id: string; // VariantUnitPrice UUID - the sellable pack size
  sku: string;
  label: string; // "Mixture - Spicy - 500 g"
  measurement: VariantMeasurement;
  basePrice: number;
  productId: string; // Product UUID
  productName: string;
  variantId: string; // Variant UUID
  variantName: string;
  inStock: boolean;
  stockQuantity: number;
}

export interface OfferListItem {
  id: string; // Offer UUID
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
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  status: OfferComputedStatus;
  createdAt: string;
  updatedAt: string;
  products: OfferProductTarget[];
  items: OfferItemTarget[];
}

export interface GetOffersParams {
  page?: number;
  limit?: number;
  search?: string;
  level?: OfferLevel;
  type?: OfferType;
  status?: OfferStatusFilter;
  categoryId?: string;
  productId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "name" | "priority" | "startsAt" | "endsAt" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface OfferListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GetOffersResult {
  data: OfferListItem[];
  meta: OfferListMeta;
}

export interface SaveOfferInput {
  name: string;
  code?: string | null;
  level: OfferLevel;
  type: OfferType;
  value?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  minQuantity?: number;
  maxQuantity?: number | null;
  minCartValue?: number | null;
  maxDiscountAmount?: number | null;
  priority?: number;
  terms?: string | null;
  startsAt: Date;
  endsAt: Date;
  isActive?: boolean;
  /** Product UUIDs - required (and only used) when `level` is `product`. */
  productIds?: string[];
  /** VariantUnitPrice UUIDs - required (and only used) when `level` is `item`. */
  itemIds?: string[];
}

export type UpdateOfferInput = Partial<SaveOfferInput>;

// ---------------------------------------------------------------------------
// Offer calculation engine
// ---------------------------------------------------------------------------

/**
 * The minimum an offer needs to be evaluated against a line. Deliberately
 * detached from Prisma rows so the same engine serves the storefront, the
 * cart, checkout and order creation.
 */
export interface ApplicableOffer {
  id: string; // Offer UUID
  internalId: bigint;
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
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

/** One priced line the engine is asked to discount. */
export interface OfferPricingLine {
  /** VariantUnitPrice UUID. */
  itemId: string;
  /** VariantUnitPrice primary key, when the caller already has it. */
  internalItemId?: bigint;
  /** Product UUID this pack size belongs to. */
  productId?: string;
  unitPrice: number;
  quantity: number;
}

export interface OfferBreakdown {
  id: string;
  name: string;
  code: string | null;
  level: OfferLevel;
  type: OfferType;
  value: number;
  terms: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

/** What the engine returns for a single line. */
export interface OfferPricingResult {
  itemId: string;
  quantity: number;
  originalPrice: number;
  /** Per-unit price after the offer, rounded to 2dp. */
  finalPrice: number;
  originalLineTotal: number;
  finalLineTotal: number;
  /** Total money saved on this line (all units). */
  discountAmount: number;
  discountPercent: number;
  offerApplied: boolean;
  offer: OfferBreakdown | null;
  /** Units given away by a Buy X Get Y offer, if any. */
  freeQuantity: number;
}

/** Shape returned by `GET /api/offers/applicable/:itemId`. */
export interface ApplicableOfferResponse {
  itemId: string;
  originalPrice: number;
  offerApplied: boolean;
  offer: OfferBreakdown | null;
  discountAmount: number;
  finalPrice: number;
}
