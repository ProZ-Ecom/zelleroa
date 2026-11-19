/**
 * Delivery environment and feature configuration.
 *
 * In testing and development, administrators can manually update courier delivery
 * statuses ('Out for Delivery' and 'Delivered') to simulate courier progress.
 *
 * In production, third-party courier services (e.g., ST Courier) push updates
 * automatically via webhooks or tracking synchronisation. Manual status transitions
 * are therefore disabled to preserve tracking integrity between admin and customer.
 */

/**
 * Returns true if the application is running in production mode.
 * Evaluates NEXT_PUBLIC_IS_PRODUCTION (accessible to both client and server),
 * fallback server-side IS_PRODUCTION / PRODUCTION, or NODE_ENV === 'production'.
 */
export function isProductionEnvironment(): boolean {
  const publicProd = process.env.NEXT_PUBLIC_IS_PRODUCTION?.trim().toLowerCase();
  if (publicProd !== undefined && publicProd !== "") {
    return publicProd === "true" || publicProd === "1" || publicProd === "yes";
  }

  if (typeof process !== "undefined" && process.env) {
    const serverProd = (process.env.IS_PRODUCTION || process.env.PRODUCTION)?.trim().toLowerCase();
    if (serverProd !== undefined && serverProd !== "") {
      return serverProd === "true" || serverProd === "1" || serverProd === "yes";
    }

    if (process.env.NODE_ENV === "production") {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether the manual admin delivery status update flow is enabled.
 *
 * - When production is false: admin manual status update flow IS SHOWN (for testing).
 * - When production is true: admin manual status update flow IS HIDDEN / DISABLED.
 *
 * Can also be explicitly overridden with NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS.
 */
export function isManualDeliveryStatusEnabled(): boolean {
  const explicit =
    process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS?.trim().toLowerCase();
  if (explicit !== undefined && explicit !== "") {
    return explicit === "true" || explicit === "1" || explicit === "yes";
  }

  return !isProductionEnvironment();
}
