/** What the report groups rows by. */
export type ValuationGroupBy = "category" | "brand";

export interface ValuationRow {
  key: string;
  name: string;
  skuCount: number;
  /** SKUs with stock but no recorded cost, so their value is missing from the total. */
  unvaluedSkus: number;
  units: number;
  /** Units on hand at average cost - what the stock is worth. */
  costValue: number;
  /** Units on hand at the current selling price. */
  retailValue: number;
  potentialProfit: number;
  /** Profit as a share of retail value; null when nothing is valued. */
  marginPercent: number | null;
}

export interface ValuationReport {
  groupBy: ValuationGroupBy;
  rows: ValuationRow[];
  totals: Omit<ValuationRow, "key" | "name">;
}

export interface SalesMarginRow {
  key: string;
  name: string;
  orderCount: number;
  unitsSold: number;
  /** What the customer paid, after item discounts and before tax. */
  revenue: number;
  estimatedCost: number;
  estimatedProfit: number;
  marginPercent: number | null;
  /** Units sold whose SKU has no cost on record, so they count as zero cost. */
  unitsWithoutCost: number;
}

export interface SalesMarginReport {
  from: string;
  to: string;
  groupBy: ValuationGroupBy;
  rows: SalesMarginRow[];
  totals: Omit<SalesMarginRow, "key" | "name">;
}

export interface ValuationParams {
  groupBy?: ValuationGroupBy;
  categorySlug?: string;
  brandSlug?: string;
}

export interface SalesMarginParams extends ValuationParams {
  from?: string;
  to?: string;
}
