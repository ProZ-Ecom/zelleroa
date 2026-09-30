/**
 * Delivery pricing rule, shared by the storefront and the server so the amount
 * shown at checkout is exactly what the order and the Razorpay charge use.
 *
 * - Tamil Nadu: free delivery
 * - Every other state: flat ₹80
 */
export const FREE_DELIVERY_STATE = "Tamil Nadu";
export const OTHER_STATE_DELIVERY_CHARGE = 80;
export const DELIVERY_ESTIMATE = "3 - 7 days";

/** Matches "Tamil Nadu", "TamilNadu", "tamil nadu", "TN", etc. */
export function isFreeDeliveryState(state?: string | null): boolean {
  const normalized = (state ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return normalized === "tamilnadu" || normalized === "tn";
}

export function getShippingCharge(state?: string | null): number {
  return isFreeDeliveryState(state) ? 0 : OTHER_STATE_DELIVERY_CHARGE;
}
