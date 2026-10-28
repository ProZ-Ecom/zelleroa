/** How a bulk change works out the new selling price for each chosen SKU. */
export type PricingMode = "manual" | "set" | "percent" | "amount" | "markup";

export type PricingRounding = "none" | "rupee";

export interface PricingRow {
  id: string;
  variantUnitPriceId: number;
  sku: string;
  productName: string;
  itemName: string | null;
  colorName: string | null;
  sizeName: string | null;
  unitName: string | null;
  sellingPrice: number;
  /** Cost of the last purchase, or null if this SKU has never been bought. */
  costPrice: number | null;
  /** Weighted average cost, what stock on hand is valued at. */
  avgCost: number | null;
  /** Profit as a share of the selling price; null when cost is unknown. */
  marginPercent: number | null;
  stock: number;
  /** Value of the stock on hand at average cost. */
  stockValue: number | null;
  isActive: boolean;
  updatedAt: string | null;
}

export interface PricingListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categorySlug?: string;
  brandSlug?: string;
  /** Only rows whose selling price is at or below cost. */
  belowCost?: boolean;
  /** Only rows with no selling price set yet. */
  unpriced?: boolean;
  /** Only rows that have never been purchased, so there is no cost to price against. */
  noCost?: boolean;
}

export interface PricingSummary {
  /** SKUs whose price actually changed. */
  updated: number;
  /** Chosen but left alone, with the reason. */
  skipped: { sku: string; reason: string }[];
}
