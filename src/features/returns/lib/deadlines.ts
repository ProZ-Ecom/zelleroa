/**
 * ============================================================================
 * GLOBAL RETURN & REPLACEMENT DEADLINES CONFIGURATION
 * ----------------------------------------------------------------------------
 * ALL return lifecycle deadlines are defined here in one single place.
 * If you need to change any deadline in the future, edit ONLY this file:
 *
 * 1. CUSTOMER_RETURN_REQUEST_DAYS (3 days):
 *    Customer can request return / replacement within 3 days of order delivery.
 *
 * 2. ADMIN_APPROVAL_DAYS (7 days / 1 week):
 *    Admin must approve or reject the return request within 1 week of request creation.
 *    If no action is taken within 1 week, the request is automatically rejected.
 *
 * 3. CUSTOMER_SHIPMENT_DAYS (3 days):
 *    Once approved, customer has 3 days from request approval date to courier the product.
 * ============================================================================
 */

export const RETURN_DEADLINES = {
  /** 1. Customer Return Request Window: 3 days from order delivery date */
  CUSTOMER_RETURN_REQUEST_DAYS: 3,

  /** 2. Admin Decision Window: 1 week (7 days) from return request creation date */
  ADMIN_APPROVAL_DAYS: 7,

  /** 3. Customer Courier Shipment Window: 3 days from request approved date */
  CUSTOMER_SHIPMENT_DAYS: 3,
} as const;

// Backward-compatible named exports
export const RETURN_WINDOW_DAYS = RETURN_DEADLINES.CUSTOMER_RETURN_REQUEST_DAYS;
export const ADMIN_REVIEW_WINDOW_DAYS = RETURN_DEADLINES.ADMIN_APPROVAL_DAYS;
export const RETURN_SHIP_WINDOW_DAYS = RETURN_DEADLINES.CUSTOMER_SHIPMENT_DAYS;

/** Store business timezone (IST, no DST). Calendar days are counted in this zone. */
export const STORE_UTC_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function storeDayStart(date: Date): number {
  const shifted = date.getTime() + STORE_UTC_OFFSET_MS;
  return Math.floor(shifted / DAY_MS) * DAY_MS - STORE_UTC_OFFSET_MS;
}

export function formatStoreDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export interface ReturnWindow {
  eligible: boolean;
  deliveredAt: Date | null;
  /** Last instant a request is accepted (end of the deadline day, store time). */
  deadline: Date | null;
  daysLeft: number;
  /** Machine readable reason when not eligible. */
  code: "OK" | "NOT_DELIVERED" | "NO_DELIVERY_DATE" | "WINDOW_EXPIRED";
  message: string;
}

export interface AdminReviewWindow {
  deadline: Date | null;
  daysLeft: number;
  expired: boolean;
}

export interface ShipWindow {
  deadline: Date | null;
  daysLeft: number;
  expired: boolean;
}

/**
 * 1. Customer Return Request Window:
 * deliveryDate + 3 days (inclusive of delivery day), evaluated on store-timezone calendar days.
 */
export function getReturnWindow(
  orderStatus: string,
  deliveredAt: Date | string | null | undefined,
  now: Date = new Date()
): ReturnWindow {
  if (orderStatus !== "delivered") {
    return {
      eligible: false,
      deliveredAt: null,
      deadline: null,
      daysLeft: 0,
      code: "NOT_DELIVERED",
      message: "Returns and replacements are only available for delivered orders.",
    };
  }

  const delivered = deliveredAt ? new Date(deliveredAt) : null;
  if (!delivered || Number.isNaN(delivered.getTime())) {
    return {
      eligible: false,
      deliveredAt: null,
      deadline: null,
      daysLeft: 0,
      code: "NO_DELIVERY_DATE",
      message: "The delivery date for this order is unavailable.",
    };
  }

  const deadline = new Date(
    storeDayStart(delivered) + RETURN_DEADLINES.CUSTOMER_RETURN_REQUEST_DAYS * DAY_MS - 1
  );
  const eligible = now.getTime() <= deadline.getTime();
  const daysLeft = eligible
    ? Math.max(
        0,
        Math.round((storeDayStart(deadline) - storeDayStart(now)) / DAY_MS) + 1
      )
    : 0;

  return {
    eligible,
    deliveredAt: delivered,
    deadline,
    daysLeft,
    code: eligible ? "OK" : "WINDOW_EXPIRED",
    message: eligible
      ? `Return period ends on ${formatStoreDate(deadline)} (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left).`
      : `Return period expired (returns are only allowed within ${RETURN_DEADLINES.CUSTOMER_RETURN_REQUEST_DAYS} days of delivery).`,
  };
}

/**
 * 2. Admin Decision Window:
 * requestedAt + 7 days (1 week), evaluated on store-timezone calendar days.
 */
export function getAdminReviewWindow(
  requestedAt: Date | string | null | undefined,
  now: Date = new Date()
): AdminReviewWindow {
  const requested = requestedAt ? new Date(requestedAt) : null;
  if (!requested || Number.isNaN(requested.getTime())) {
    return { deadline: null, daysLeft: 0, expired: false };
  }
  const deadline = new Date(
    storeDayStart(requested) + RETURN_DEADLINES.ADMIN_APPROVAL_DAYS * DAY_MS - 1
  );
  const expired = now.getTime() > deadline.getTime();
  const daysLeft = expired
    ? 0
    : Math.max(
        0,
        Math.round((storeDayStart(deadline) - storeDayStart(now)) / DAY_MS) + 1
      );
  return { deadline, daysLeft, expired };
}

/**
 * 3. Customer Courier Shipment Window:
 * approvedAt + 3 days, evaluated on store-timezone calendar days.
 */
export function getShipWindow(
  approvedAt: Date | string | null | undefined,
  now: Date = new Date()
): ShipWindow {
  const approved = approvedAt ? new Date(approvedAt) : null;
  if (!approved || Number.isNaN(approved.getTime())) {
    return { deadline: null, daysLeft: 0, expired: false };
  }
  const deadline = new Date(
    storeDayStart(approved) + RETURN_DEADLINES.CUSTOMER_SHIPMENT_DAYS * DAY_MS - 1
  );
  const expired = now.getTime() > deadline.getTime();
  return {
    deadline,
    daysLeft: expired
      ? 0
      : Math.max(
          0,
          Math.round((storeDayStart(deadline) - storeDayStart(now)) / DAY_MS) + 1
        ),
    expired,
  };
}
