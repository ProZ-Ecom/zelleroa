/**
 * Shared (client + server safe) business rules for order cancellation,
 * returns and replacements. The backend is the source of truth - the UI only
 * mirrors these helpers for display.
 */

// ── Return / replacement window ────────────────────────────────────────────

export const RETURN_WINDOW_DAYS = 3;

/** Store business timezone (IST, no DST). Calendar days are counted in this zone. */
const STORE_UTC_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function storeDayStart(date: Date): number {
  const shifted = date.getTime() + STORE_UTC_OFFSET_MS;
  return Math.floor(shifted / DAY_MS) * DAY_MS - STORE_UTC_OFFSET_MS;
}

/**
 * deliveryDate + 3 days >= currentDate, evaluated on store-timezone calendar
 * days. Delivered 2026-09-20 -> requests accepted through 2026-09-23 23:59:59.
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
    storeDayStart(delivered) + (RETURN_WINDOW_DAYS + 1) * DAY_MS - 1
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
      ? `Return period ends on ${formatStoreDate(deadline)}.`
      : "Return period expired",
  };
}

export function formatStoreDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

// ── Cancellation ────────────────────────────────────────────────────────────

/** Order statuses a customer may still cancel from. */
export const CUSTOMER_CANCELLABLE_STATUSES = [
  "pending",
  "confirmed",
  "processing",
] as const;

export function isOrderCancellable(status: string): boolean {
  return (CUSTOMER_CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

export const CANCELLATION_REASONS = [
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Delivery time is too long",
  "Want to change size / color / product",
  "Want to change delivery address",
  "Payment issue",
  "Other",
] as const;

// ── Return / replacement reasons ────────────────────────────────────────────

export const RETURN_REASONS = [
  "Damaged product",
  "Wrong product received",
  "Wrong size",
  "Product quality issue",
  "Missing item",
  "Product does not match description",
  "Other",
] as const;

export const REPLACEMENT_REASONS = [
  "Damaged product",
  "Wrong product received",
  "Wrong size",
  "Quality issue",
  "Missing item",
  "Other",
] as const;

// ── Unboxing video ─────────────────────────────────────────────────────────

export const UNBOXING_VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
export const UNBOXING_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
export const UNBOXING_VIDEO_MANDATORY_NOTICE =
  "Unboxing video is mandatory for return/replacement requests.";
export const UNBOXING_VIDEO_URL_PREFIX = "/api/returns/videos/";

// ── Return workflow ────────────────────────────────────────────────────────

export const RETURN_STATUSES = [
  "return_requested",
  "under_review",
  "approved",
  "rejected",
  "pickup_scheduled",
  "picked_up",
  "received",
  "refund_pending",
  "refunded",
  "closed",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** Return statuses that still count as an "active" request for an item. */
export const RETURN_ACTIVE_STATUSES: ReturnStatus[] = [
  "return_requested",
  "under_review",
  "approved",
  "pickup_scheduled",
  "picked_up",
  "received",
  "refund_pending",
  "refunded",
];

export type ReturnAction =
  | "review"
  | "approve"
  | "reject"
  | "pickup"
  | "picked-up"
  | "received"
  | "refund"
  | "complete"
  | "close";

export const RETURN_TRANSITIONS: Record<
  ReturnAction,
  { from: ReturnStatus[]; to: ReturnStatus; label: string }
> = {
  review: { from: ["return_requested"], to: "under_review", label: "Start Review" },
  approve: { from: ["return_requested", "under_review"], to: "approved", label: "Approve" },
  reject: { from: ["return_requested", "under_review"], to: "rejected", label: "Reject" },
  pickup: { from: ["approved"], to: "pickup_scheduled", label: "Schedule Pickup" },
  "picked-up": { from: ["pickup_scheduled"], to: "picked_up", label: "Mark as Picked Up" },
  received: { from: ["picked_up"], to: "received", label: "Mark as Received" },
  refund: { from: ["received"], to: "refund_pending", label: "Initiate Refund" },
  complete: { from: ["refund_pending"], to: "refunded", label: "Mark Refunded" },
  close: { from: ["refunded", "rejected"], to: "closed", label: "Close Request" },
};

// ── Replacement workflow ───────────────────────────────────────────────────

export const REPLACEMENT_STATUSES = [
  "replacement_requested",
  "under_review",
  "approved",
  "rejected",
  "pickup_scheduled",
  "picked_up",
  "replacement_processing",
  "replacement_shipped",
  "replaced",
  "closed",
] as const;
export type ReplacementStatus = (typeof REPLACEMENT_STATUSES)[number];

export const REPLACEMENT_ACTIVE_STATUSES: ReplacementStatus[] = [
  "replacement_requested",
  "under_review",
  "approved",
  "pickup_scheduled",
  "picked_up",
  "replacement_processing",
  "replacement_shipped",
  "replaced",
];

export type ReplacementAction =
  | "review"
  | "approve"
  | "reject"
  | "pickup"
  | "picked-up"
  | "process"
  | "ship"
  | "complete"
  | "close";

export const REPLACEMENT_TRANSITIONS: Record<
  ReplacementAction,
  { from: ReplacementStatus[]; to: ReplacementStatus; label: string }
> = {
  review: { from: ["replacement_requested"], to: "under_review", label: "Start Review" },
  approve: { from: ["replacement_requested", "under_review"], to: "approved", label: "Approve" },
  reject: { from: ["replacement_requested", "under_review"], to: "rejected", label: "Reject" },
  pickup: { from: ["approved"], to: "pickup_scheduled", label: "Schedule Pickup" },
  "picked-up": { from: ["pickup_scheduled"], to: "picked_up", label: "Mark as Picked Up" },
  process: { from: ["picked_up"], to: "replacement_processing", label: "Process Replacement" },
  ship: { from: ["replacement_processing"], to: "replacement_shipped", label: "Mark Replacement Shipped" },
  complete: { from: ["replacement_shipped"], to: "replaced", label: "Mark Replacement Delivered" },
  close: { from: ["replaced", "rejected"], to: "closed", label: "Close Request" },
};

export function availableActions<A extends string>(
  transitions: Record<A, { from: readonly string[]; label: string }>,
  status: string
): { action: A; label: string }[] {
  return (Object.keys(transitions) as A[])
    .filter((a) => transitions[a].from.includes(status))
    .map((a) => ({ action: a, label: transitions[a].label }));
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Ordered happy-path used to render "upcoming" steps in request timelines. */
export const RETURN_FLOW: ReturnStatus[] = [
  "return_requested",
  "under_review",
  "approved",
  "pickup_scheduled",
  "picked_up",
  "received",
  "refund_pending",
  "refunded",
];

export const REPLACEMENT_FLOW: ReplacementStatus[] = [
  "replacement_requested",
  "under_review",
  "approved",
  "pickup_scheduled",
  "picked_up",
  "replacement_processing",
  "replacement_shipped",
  "replaced",
  "closed",
];
