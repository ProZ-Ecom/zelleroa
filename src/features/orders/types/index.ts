import type { orders_order_status, orders_payment_status, order_addresses_type } from "@/generated/prisma";
import type { VariantMeasurement } from "@/features/variants/utils/measurement.util";
import type {
  CancellationInfo,
  OrderRefundInfo,
  RequestSummary,
  TimelineEvent,
} from "@/features/returns/lib/summary";
import type { ReturnWindow } from "@/features/returns/lib/policy";

export type OrderStatus = orders_order_status;
export type PaymentStatus = orders_payment_status;
export type OrderAddressType = order_addresses_type;

export interface OrderCustomerDto {
  id: string; // user.uuid
  customerId: string | null; // user.cust_id
  name: string;
  email: string | null;
  phone: string | null;
}

export interface OrderItemResponse {
  id: string; // order_item.uuid
  productId: string; // product.uuid
  itemId: string; // item.uuid
  variantId: string; // variant.uuid (Color level)
  variantUnitPriceId: string; // variant_unit_price.uuid (Size/pack)
  productName: string; // snapshot
  itemName: string; // snapshot
  variantName: string; // snapshot
  sku: string; // snapshot
  measurement: VariantMeasurement;
  /** Options selected at purchase time (Color, Size, custom attributes). */
  attributes: Array<{ name: string; value: string }>;
  primaryImage: string | null;
  /** Color of the ordered variant (live lookup; null if the variant has no color). */
  colorName: string | null;
  colorHex: string | null;
  quantity: number;
  /** Undiscounted price per unit at the time the order was placed. */
  unitPrice: number;
  /** Money the applied offer took off this line, across all its units. */
  discountAmount: number;
  taxAmount: number;
  /** What the customer actually paid for this line, after the offer. */
  totalPrice: number;
}

export interface OrderAddressResponse {
  id: string; // address.uuid
  type: OrderAddressType;
  addressType: "shipping" | "billing";
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export interface OrderStatusHistoryResponse {
  id: string; // history id string or uuid
  status: string;
  note: string | null;
  createdAt: Date;
}

export interface OrderDeliveryStaffDto {
  id: string; // staff.uuid
  name: string;
  email: string | null;
  phone: string | null;
}

export interface OrderDeliveryDto {
  isAssigned: boolean;
  assignmentStatus: string | null;
  deliveryId: string | null;
  staff: OrderDeliveryStaffDto | null;
  assignedAt: Date | string | null;
}

export interface OrderCourierTrackingEventDto {
  status: string;
  location: string | null;
  note: string | null;
  trackedAt: Date;
}

export interface OrderCourierShipmentDto {
  id: string; // shipment.uuid
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  status: string;
  timeline: OrderCourierTrackingEventDto[];
}

export interface OrderListItemResponse {
  id: string; // order.uuid
  orderNumber: string;
  customer: OrderCustomerDto;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingCharge: number;
  totalAmount: number;
  totalItems: number;
  delivery?: OrderDeliveryDto;
  courierShipment?: OrderCourierShipmentDto | null;
  notes: string | null;
  placedAt: Date | null;
  deliveredAt?: Date | null;
  /** Present once the order has been cancelled. */
  cancellation?: CancellationInfo | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Order-specific referral attribution. Admin-facing only - never sent to customers. */
export interface OrderReferralDto {
  /** CUSTOMER_DIRECT | AGENT_PLACED_FOR_CUSTOMER | AGENT_OWN */
  orderSource: string;
  orderedByName: string | null;
  /** Set when an agent keyed the order in for a buyer without an account. */
  manualCustomer: { name: string; phone: string | null } | null;
  referralCode: string | null;
  agentName: string;
  agentCode: string | null;
  /** Blended commission % over the order's commissionable amount. */
  commissionPercentage: number;
  commissionAmount: number;
  /** Single status when all item commissions agree, otherwise "mixed". */
  commissionStatus: string;
}

export interface OrderDetailResponse extends OrderListItemResponse {
  referral?: OrderReferralDto | null;
  items: OrderItemResponse[];
  shippingAddress: OrderAddressResponse | null;
  billingAddress: OrderAddressResponse | null;
  statusHistory: OrderStatusHistoryResponse[];
  /** 3-day return/replacement window, computed on the server from `deliveredAt`. */
  returnWindow?: Omit<ReturnWindow, "deliveredAt"> & { deliveredAt: Date | null };
  refunds?: OrderRefundInfo[];
  returnRequests?: RequestSummary[];
  replacementRequests?: RequestSummary[];
  timeline?: TimelineEvent[];
}

export interface OrderStatusTransitionResponse {
  id: string;
  orderNumber: string;
  status: OrderStatus;
}

export interface OrderPaginationMeta {
  page: number;
  limit: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface OrderListResponse<T = OrderListItemResponse> {
  data: T[];
  meta: OrderPaginationMeta;
}

export type DeliveryMethod = "standard" | "express";
export type PaymentMethod =
  | "CASH_ON_DELIVERY"
  | "UPI"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "NET_BANKING"
  | "WALLET"
  | "CARD"
  | "COD";

export interface GetOrdersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface OrderListItem {
  id: number | string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  itemCount?: number;
  totalItems?: number;
  createdAt: Date | string;
  items?: OrderItemResponse[];
  customer?: OrderCustomerDto;
}

export interface OrderDetail extends OrderListItem {
  shippingAddress?: OrderAddressResponse | null;
  billingAddress?: OrderAddressResponse | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingCharge: number;
  notes?: string | null;
}

export interface GetOrdersResult {
  orders: OrderListItem[];
  pagination?: OrderPaginationMeta;
  total?: number;
}

export interface PlaceOrderInput {
  shippingAddressId?: string;
  addressId?: number | string;
  billingAddressId?: string;
  deliveryMethod?: DeliveryMethod | string;
  paymentMethod?: PaymentMethod | string;
  couponCode?: string;
  notes?: string;
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  note?: string;
}

export interface CheckoutSummary {
  subtotal: number;
  discountAmount?: number;
  discount?: number;
  taxAmount?: number;
  shippingCharge?: number;
  deliveryCharge?: number;
  totalAmount?: number;
  total?: number;
  totalSavings?: number;
  items?: any[];
  totals?: {
    subtotal: number;
    shipping: number;
    discount: number;
    total: number;
  };
  coupon?: { code: string; discount: number } | null;
  couponCode?: string | null;
  appliedCoupon?: unknown;
}

export interface AdminOrdersListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  sortBy?:
    | "orderNumber"
    | "createdAt"
    | "updatedAt"
    | "placedAt"
    | "totalAmount"
    | "orderStatus"
    | "paymentStatus";
  sortOrder?: "asc" | "desc";
}

export interface OrderItemDisplay {
  id: string;
  productName: string;
  productSlug?: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  price: number;
  total: number;
  image?: string | null;
}

export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
] as const;

export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partial_refund",
] as const;

export interface AdminOrdersCountResponse {
  pending: number;
  confirmed: number;
  processing: number;
  packed: number;
  shipped: number;
  out_for_delivery: number;
  delivered: number;
  cancelled: number;
  returned: number;
  total: number;
}


