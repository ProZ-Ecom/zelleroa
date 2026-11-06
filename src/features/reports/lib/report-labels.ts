/**
 * Labels shared by the report services and their pages, so a channel or status
 * never shows as a raw enum value in one place and a friendly name in another.
 * Keys must match the Prisma enums exactly.
 */

export const ORDER_SOURCE_LABELS: Record<string, string> = {
  CUSTOMER_DIRECT: "Customer (direct)",
  AGENT_PLACED_FOR_CUSTOMER: "Sales partner placed",
  AGENT_OWN: "Sales partner own purchase",
};

export const ORDER_SOURCE_OPTIONS = Object.entries(ORDER_SOURCE_LABELS).map(([value, label]) => ({ value, label }));

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

/** Pipeline order as operations read it, so status tables never shuffle. */
export const ORDER_STATUS_ORDER = Object.keys(ORDER_STATUS_LABELS);

export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));

/** Everything between placed and delivered. */
export const IN_PROGRESS_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
] as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partial_refund: "Partially refunded",
};

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export const STOCK_MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE: "Purchase received",
  SALE: "Sold",
  RETURN: "Customer return",
  REPLACEMENT: "Replacement",
  ADJUSTMENT: "Manual adjustment",
  PURCHASE_RETURN: "Returned to vendor",
  DAMAGE: "Damage / write-off",
  /** Ledger rows written before `movement_type` existed. */
  LEGACY: "Before the ledger",
};

export const label = (map: Record<string, string>, key: string | null | undefined) =>
  key == null ? "—" : (map[key] ?? key);
