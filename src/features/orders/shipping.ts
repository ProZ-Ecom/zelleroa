/**
 * Delivery pricing rules, shared by the storefront and the server so the amount
 * shown at checkout is exactly what the order and the Razorpay charge use.
 *
 * - Standard Delivery: free within Tamil Nadu, ₹80 to any other state (3 - 5 days)
 * - Express Delivery: flat ₹99 (1 - 2 days)
 */
export const FREE_DELIVERY_STATE = "Tamil Nadu";
export const STANDARD_DELIVERY_CHARGE = 49;
export const EXPRESS_DELIVERY_CHARGE = 99;
export const OTHER_STATE_DELIVERY_CHARGE = 80;
export const STANDARD_DELIVERY_ESTIMATE = "3 - 5 days";
export const EXPRESS_DELIVERY_ESTIMATE = "1 - 2 days";
export const DELIVERY_ESTIMATE = STANDARD_DELIVERY_ESTIMATE;

export type DeliveryMethod = "standard" | "express";

/** Matches "Tamil Nadu", "TamilNadu", "tamil nadu", "TN", etc. */
export function isFreeDeliveryState(state?: string | null): boolean {
  const normalized = (state ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return normalized === "tamilnadu" || normalized === "tn";
}

export function getShippingCharge(
  state?: string | null,
  deliveryMethod?: DeliveryMethod | string | null
): number {
  const method = String(deliveryMethod || "standard").toLowerCase();
  if (method === "express") {
    return EXPRESS_DELIVERY_CHARGE;
  }
  return isFreeDeliveryState(state) ? 0 : OTHER_STATE_DELIVERY_CHARGE;
}
