export type MovementType = "PURCHASE" | "SALE" | "RETURN" | "REPLACEMENT" | "ADJUSTMENT";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface StockItemLabel {
  variantUnitPriceId: number;
  productName: string;
  itemName: string | null;
  colorName: string | null;
  sizeName: string | null;
  sku: string;
}

export interface StockRow extends StockItemLabel {
  available: number;
  reserved: number;
  reorderLevel: number;
  threshold: number;
  status: StockStatus;
  updatedAt: string | null;
}

export interface MovementRow extends StockItemLabel {
  id: number;
  movementType: MovementType | null;
  direction: "in" | "out";
  quantity: number;
  signedQuantity: number;
  previousStock: number | null;
  newStock: number | null;
  referenceType: string | null;
  referenceId: number | null;
  referenceNumber: string | null;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface MovementSummaryRow {
  movementType: MovementType | null;
  movements: number;
  unitsIn: number;
  unitsOut: number;
}

export interface StockValueSummary {
  costValue: number;
  retailValue: number;
  potentialProfit: number;
  marginPercent: number | null;
  /** SKUs with stock but no cost on record, so they are missing from the money columns. */
  unvaluedSkus: number;
}

export interface CategoryStockValue {
  key: string;
  name: string;
  skuCount: number;
  units: number;
  costValue: number;
  retailValue: number;
}

export interface InventoryDashboard {
  lowStockThreshold: number;
  /** How many days back the movement summary covers. */
  windowDays: number;
  totalProducts: number;
  totalVariants: number;
  totalAvailableStock: number;
  totalReservedStock: number;
  inStockItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  stockValue: StockValueSummary;
  topCategories: CategoryStockValue[];
  /** The emptiest low / out-of-stock rows, worst first. */
  needsReorder: StockRow[];
  /** Every low or out-of-stock row, not just the ones listed. */
  reorderCount: number;
  movementSummary: MovementSummaryRow[];
  recentPurchases: {
    id: string;
    poNumber: string;
    vendorName: string;
    status: string;
    itemCount: number;
    totalAmount: number;
    purchaseDate: string;
  }[];
  recentMovements: MovementRow[];
}

export interface StockListParams {
  page?: number;
  limit?: number;
  search?: string;
  color?: string;
  categorySlug?: string;
  productSlug?: string;
  variantUnitPriceId?: number;
  status?: StockStatus;
}

export interface MovementListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: MovementType;
  variantUnitPriceId?: number;
  from?: string;
  to?: string;
}

export interface AdjustmentPayload {
  variantUnitPriceId: number;
  direction: "in" | "out";
  quantity: number;
  reason: string;
}
