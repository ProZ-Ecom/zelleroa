/**
 * Shared (client + server safe) constants for the "mobile verification
 * required to place an order" rule. The on/off switch itself is server-only
 * config: see src/features/orders/lib/mobile-verification.ts.
 */
export const MOBILE_VERIFICATION_REQUIRED_CODE = "MOBILE_VERIFICATION_REQUIRED";

export const MOBILE_VERIFICATION_REQUIRED_MESSAGE =
  "Please verify your mobile number before placing an order.";

/** Where the storefront sends a customer to complete mobile verification. */
export const MOBILE_VERIFICATION_PATH = "/profile";
