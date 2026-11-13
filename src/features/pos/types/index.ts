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
  unitPrice: number;
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
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
  paymentMode: PosPaymentMode;
  cashReceived: number | null;
  changeDue: number | null;
}

export interface PosCustomerLookupDto {
  userId: number | null;
  name: string | null;
  phone: string;
  found: boolean;
}
