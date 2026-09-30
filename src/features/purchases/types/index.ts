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
  sku: string;
  stock: number;
  reorderLevel: number;
}
