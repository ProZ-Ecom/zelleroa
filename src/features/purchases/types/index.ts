export type PurchaseStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export interface VendorResponse {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface VendorDetailResponse extends VendorResponse {
  stats: {
    totalPurchases: number;
    totalPurchaseAmount: number;
    lastPurchaseDate: string | null;
  };
}

export interface GetVendorsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface PurchaseItemResponse {
  id: number;
  variantUnitPriceId: number;
  productName: string;
  variantName: string | null;
  colorName: string | null;
  sizeName: string | null;
  unitName: string | null;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
}

export interface PurchaseReceiptResponse {
  id: number;
  receiptNumber: string;
  receivedAt: string;
  notes: string | null;
  items: { productName: string; sku: string; quantity: number; unitCost: number }[];
}

export interface PurchaseOrderResponse {
  id: string;
  poNumber: string;
  status: PurchaseStatus;
  vendor: { id: string; name: string; code: string };
  expectedDate: string | null;
  purchaseDate: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  rejectReason: string | null;
  subtotal: number;
  additionalCharges: number;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  approvedAt: string | null;
  items?: PurchaseItemResponse[];
  history?: PurchaseHistoryEntry[];
  receipts?: PurchaseReceiptResponse[];
}

export interface GetPurchasesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: PurchaseStatus;
  vendorId?: string;
}

export interface PurchaseProductOption {
  variantUnitPriceId: number;
  label: string;
  productName: string;
  colorName: string | null;
  sizeName: string | null;
  sku: string;
  stock: number;
  reorderLevel: number;
}

export type PurchaseReturnStatus = "DRAFT" | "SUBMITTED" | "COMPLETED" | "CANCELLED";

export type PurchaseReturnReason =
  | "DAMAGED"
  | "WRONG_ITEM"
  | "EXPIRED"
  | "SHORT_SUPPLY"
  | "QUALITY"
  | "OTHER";

export interface PurchaseReturnItemResponse {
  id: number;
  purchaseOrderItemId: number;
  variantUnitPriceId: number;
  productName: string;
  variantName: string | null;
  colorName: string | null;
  sizeName: string | null;
  unitName: string | null;
  sku: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  /**
   * False for units refused at the door: they never reached stock, so
   * completing the return claims the money without moving stock.
   */
  affectsStock: boolean;
  reason: PurchaseReturnReason;
  notes: string | null;
}

export interface PurchaseReturnResponse {
  id: string;
  returnNumber: string;
  status: PurchaseReturnStatus;
  vendor: { id: string; name: string; code: string; address: string | null; gstin: string | null };
  purchaseOrder: { id: string; poNumber: string; invoiceNumber: string | null };
  returnDate: string | null;
  debitNoteNumber: string | null;
  notes: string | null;
  totalAmount: number;
  itemCount: number;
  /** Units on this return that will leave stock when it is completed. */
  stockUnits: number;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items?: PurchaseReturnItemResponse[];
}

export interface GetPurchaseReturnsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: PurchaseReturnStatus;
  vendorId?: string;
}

/** A received purchase line with however much of it can still be sent back. */
export interface ReturnableItem {
  purchaseOrderItemId: number;
  variantUnitPriceId: number;
  productName: string;
  variantName: string | null;
  colorName: string | null;
  sizeName: string | null;
  unitName: string | null;
  sku: string;
  quantityReceived: number;
  quantityReturned: number;
  returnable: number;
  unitCost: number;
  currentStock: number;
}

export interface ReturnableOrder {
  id: string;
  poNumber: string;
  invoiceNumber: string | null;
  purchaseDate: string | null;
  vendor: { id: string; name: string; code: string };
  items: ReturnableItem[];
}

export interface PurchaseImportItem {
  row: number;
  sku: string;
  productName: string;
  variantUnitPriceId: number;
  /** Units the vendor delivered and billed for, damaged ones included. */
  quantity: number;
  damagedQuantity: number;
  /** quantity - damagedQuantity; only these reach stock. */
  goodQuantity: number;
  unitCost: number;
  /** Cost of the previous purchase of this SKU, or null if never bought. */
  lastCost: number | null;
  currentStock: number;
  newStock: number;
  currentSellingPrice: number;
  /** New selling price to apply, or null to leave the price alone. */
  sellingPrice: number | null;
  remarks: string | null;
}

export interface PurchaseImportPreview {
  fileName: string;
  vendor: { id: string; code: string; name: string; address: string | null };
  invoiceNumber: string;
  purchaseDate: string;
  additionalCharges: number;
  notes: string | null;
  /** Derived from vendor + invoice number; resubmitting it never adds stock twice. */
  idempotencyKey: string;
  items: PurchaseImportItem[];
  subtotal: number;
  total: number;
  unitsReceived: number;
  unitsDamaged: number;
  priceChanges: number;
  errors: string[];
  /** Worth a second look but not blocking, e.g. a large jump in cost. */
  warnings: string[];
  /** PO number when this vendor invoice was already imported. */
  alreadyImportedAs: string | null;
}
