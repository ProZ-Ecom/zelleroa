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

export interface InventoryDashboard {
  lowStockThreshold: number;
  totalProducts: number;
  totalVariants: number;
  totalAvailableStock: number;
  lowStockItems: number;
  outOfStockItems: number;
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
