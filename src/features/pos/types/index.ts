/** Shapes the counter screen and its API speak in. */

export type PosPaymentMode = "CASH" | "UPI" | "CARD";

export interface PosStoreDto {
  id: number;
  uuid: string;
  name: string;
  code: string;
  addressLines: string[];
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  phone: string | null;
  gstin: string | null;
  invoicePrefix: string;
  /** Percent a cashier may discount without a manager; 0 means none. */
  maxCashierDiscountPercent: number;
}

/** A SKU as the billing screen sees it: priced, and with sellable stock resolved. */
export interface PosProductOption {
  variantUnitPriceId: number;
  sku: string;
  label: string;
  productName: string;
  variantName: string | null;
  colorName: string | null;
  sizeName: string | null;
  originalPrice: number;
  unitPrice: number;
  discountAmount?: number;
  discountPercent?: number;
  offerName?: string | null;
  /** quantity_available minus what online carts and orders are holding. */
  sellable: number;
}

export interface PosSessionDto {
  id: number;
  uuid: string;
  status: "OPEN" | "CLOSED";
  storeId: number;
  storeName: string;
  staffUserId: number;
  staffName: string;
  openedAt: string;
  openingCash: number;
  closedAt: string | null;
  closingCashCounted: number | null;
  expectedCash: number | null;
  cashVariance: number | null;
  varianceReason: string | null;
}

/** Running totals for one shift: what the close screen and the report both show. */
export interface PosSessionSummary {
  session: PosSessionDto;
  billCount: number;
  voidedCount: number;
  grossSales: number;
  refunds: number;
  netSales: number;
  cash: number;
  upi: number;
  card: number;
  /** openingCash + cash taken in - cash refunded. */
  expectedCash: number;
}

export interface PosBillLineDto {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

/** Everything the thermal receipt needs, returned by the bill call itself. */
export interface PosBillDto {
  orderUuid: string;
  orderNumber: string;
  invoiceNumber: string;
  billedAt: string;
  store: PosStoreDto;
  cashierName: string;
  customerName: string | null;
  customerPhone: string | null;
  lines: PosBillLineDto[];
  subtotal: number;
  discountAmount: number;
  offerDiscount?: number;
  couponDiscount?: number;
  couponCode?: string | null;
  manualDiscount?: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
  paymentMode: PosPaymentMode;
  cashReceived: number | null;
  changeDue: number | null;
}

export interface PosCouponResult {
  couponId: number;
  code: string;
  discountAmount: number;
  eligibleSubtotal: number;
}

export interface PosCustomerLookupDto {
  userId: number | null;
  name: string | null;
  phone: string;
  found: boolean;
}

export interface PosPurchaseListItem {
  orderUuid: string;
  orderNumber: string;
  invoiceNumber: string | null;
  placedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  cashierName: string;
  storeName: string;
  paymentMode: PosPaymentMode;
  paymentReference: string | null;
  itemCount: number;
  itemsSummary: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: "delivered" | "cancelled";
}

export interface PosPurchasesSummary {
  totalCount: number;
  deliveredCount: number;
  voidedCount: number;
  grossSales: number;
  netSales: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
}

export interface PosPurchasesResponse {
  data: PosPurchaseListItem[];
  summary: PosPurchasesSummary;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type PosItemCondition = "RESTOCKABLE" | "DEFECTIVE";

export const POS_EXCHANGE_REASONS = [
  "Size Issue",
  "Color Issue",
  "Product Defect",
  "Wrong Product",
  "Quality Issue",
  "Other",
] as const;

export type PosExchangeReason = (typeof POS_EXCHANGE_REASONS)[number];

export interface PosExchangeEligibleItem {
  orderItemId: number;
  variantUnitPriceId: number;
  sku: string;
  productName: string;
  variantName: string;
  attributes: Array<{ name: string; value: string }>;
  purchasedQuantity: number;
  alreadyExchangedQuantity: number;
  eligibleQuantity: number;
  originalUnitPrice: number;
  discountAmount: number;
  effectiveUnitPrice: number;
  totalPrice: number;
}

export interface PosExchangeBillLookupDto {
  orderId: number;
  orderUuid: string;
  orderNumber: string;
  invoiceNumber: string | null;
  storeId: number;
  storeName: string;
  placedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  paymentMode: PosPaymentMode | string;
  items: PosExchangeEligibleItem[];
}

export interface PosExchangeReturnLineDto {
  orderItemId: number;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  condition: PosItemCondition;
  reason: string;
  reasonDetail?: string | null;
}

export interface PosExchangeReceiptDto {
  exchangeUuid: string;
  exchangeNumber: string;
  originalOrderNumber: string;
  originalInvoiceNumber: string | null;
  originalPlacedAt: string;
  exchangedAt: string;
  store: PosStoreDto;
  cashierName: string;
  approvingManagerName?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  returnLines: PosExchangeReturnLineDto[];
  newLines: PosBillLineDto[];
  totalReturnedValue: number;
  totalNewValue: number;
  netPayable: number;
  paymentMode: PosPaymentMode | null;
  cashReceived: number | null;
  changeDue: number | null;
  paymentReference: string | null;
  reason: string | null;
  notes: string | null;
  taxableValue?: number;
  cgstAmount?: number;
  sgstAmount?: number;
}
