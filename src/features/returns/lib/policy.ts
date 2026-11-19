/**
 * Shared (client + server safe) business rules for order cancellation,
 * returns and replacements. The backend is the source of truth - the UI only
 * mirrors these helpers for display.
 */

// Centralized deadlines configuration
export * from "./deadlines";
import {
  RETURN_DEADLINES,
  RETURN_WINDOW_DAYS,
  ADMIN_REVIEW_WINDOW_DAYS,
  RETURN_SHIP_WINDOW_DAYS,
  storeDayStart,
  formatStoreDate,
  getReturnWindow,
  getAdminReviewWindow,
  getShipWindow,
  type ReturnWindow,
  type AdminReviewWindow,
  type ShipWindow,
} from "./deadlines";

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

/**
 * Reasons available when requesting a product return.
 */
export const RETURN_REASONS = [
  "Damaged product",
  "Wrong product received",
  "Wrong size",
  "Quality issue",
  "Missing item",
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

// ── Return shipping slip ───────────────────────────────────────────────────

/**
 * Proof that the customer actually posted the parcel. Like the unboxing video
 * this is private customer evidence - it carries names, addresses and a
 * tracking number - so it is served through an authenticated endpoint rather
 * than from the public document root.
 */
export const SHIPPING_SLIP_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const SHIPPING_SLIP_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;
export const SHIPPING_SLIP_URL_PREFIX = "/api/returns/slips/";
/** Admin-side uploads land in the shared document root instead. */
export const ADMIN_UPLOAD_URL_PREFIX = "/document/";
export const SHIPPING_SLIP_MANDATORY_NOTICE =
  "A photo of the courier / delivery slip is mandatory when adding shipping details.";

/** True for either an authenticated customer slip or an admin-uploaded image. */
export function isShippingSlipUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith(SHIPPING_SLIP_URL_PREFIX) || url.startsWith(ADMIN_UPLOAD_URL_PREFIX)
  );
}

// ── Return workflow ────────────────────────────────────────────────────────

/**
 * `pickup_scheduled` / `picked_up` are retired for returns - the customer now
 * ships the item back with a courier of their choice. Both values stay in the
 * union so historical rows still type-check.
 */
export const RETURN_STATUSES = [
  "return_requested",
  "under_review",
  "approved",
  "rejected",
  "pickup_scheduled",
  "picked_up",
  "shipped_by_customer",
  "received",
  "qc_failed",
  "returning_to_customer",
  "returned_to_customer",
  "refund_pending",
  "refunded",
  "expired",
  "cancelled",
  "closed",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** Statuses offered in admin filters - the retired pickup ones stay hidden. */
export const RETURN_SELECTABLE_STATUSES: ReturnStatus[] = RETURN_STATUSES.filter(
  (s) => s !== "pickup_scheduled" && s !== "picked_up"
);

/** Return statuses that still count as an "active" request for an item. */
export const RETURN_ACTIVE_STATUSES: ReturnStatus[] = [
  "return_requested",
  "under_review",
  "approved",
  "pickup_scheduled",
  "picked_up",
  "shipped_by_customer",
  "received",
  "qc_failed",
  "returning_to_customer",
  "returned_to_customer",
  "refund_pending",
  "refunded",
];

/**
 * Terminal statuses that hand the item back to the customer - the order item is
 * free to be returned or replaced again, as long as the window is still open.
 */
export const RETURN_RELEASING_STATUSES: ReturnStatus[] = [
  "rejected",
  "expired",
  "cancelled",
];

/**
 * Off-happy-path endings. The customer timeline shows only the one that
 * happened and hides every remaining pending step.
 */
export const RETURN_EXCEPTION_STATUSES: ReturnStatus[] = [
  "rejected",
  "expired",
  "qc_failed",
  "returning_to_customer",
  "returned_to_customer",
  "cancelled",
];

export function isReturnExceptionStatus(status: string): boolean {
  return (RETURN_EXCEPTION_STATUSES as readonly string[]).includes(status);
}

export type ReturnAction =
  | "review"
  | "approve"
  | "reject"
  | "shipped"
  | "received"
  | "qc-fail"
  | "send-back"
  | "delivered-back"
  | "refund"
  | "complete"
  | "expire"
  | "cancel"
  | "close";

export const RETURN_TRANSITIONS: Record<
  ReturnAction,
  { from: ReturnStatus[]; to: ReturnStatus; label: string }
> = {
  review: { from: ["return_requested"], to: "under_review", label: "Start Review" },
  approve: { from: ["return_requested", "under_review"], to: "approved", label: "Approve" },
  reject: { from: ["return_requested", "under_review"], to: "rejected", label: "Reject" },
  shipped: {
    from: ["approved", "pickup_scheduled"],
    to: "shipped_by_customer",
    label: "Mark as Shipped by Customer",
  },
  received: {
    from: ["shipped_by_customer", "picked_up"],
    to: "received",
    label: "Mark as Received",
  },
  "qc-fail": { from: ["received"], to: "qc_failed", label: "Fail Quality Check" },
  // A failed check leaves us holding goods that are still the customer's, so
  // the request is not finished until the item is back with them.
  "send-back": {
    from: ["qc_failed"],
    to: "returning_to_customer",
    label: "Send Item Back to Customer",
  },
  "delivered-back": {
    from: ["returning_to_customer"],
    to: "returned_to_customer",
    label: "Mark Delivered to Customer",
  },
  refund: { from: ["received"], to: "refund_pending", label: "Pass QC & Initiate Refund" },
  complete: { from: ["refund_pending"], to: "refunded", label: "Mark Refunded" },
  expire: { from: ["approved"], to: "expired", label: "Close as Expired" },
  cancel: {
    from: ["return_requested", "under_review", "approved"],
    to: "cancelled",
    label: "Cancel Request",
  },
  close: {
    from: [
      "refunded",
      "rejected",
      "qc_failed",
      "returned_to_customer",
      "expired",
      "cancelled",
    ],
    to: "closed",
    label: "Close Request",
  },
};

/**
 * What happens to the physical item once it passes inspection. A resellable
 * item goes back on the shelf; a damaged one is taken in (so the customer is
 * still refunded) but written off, never offered for sale again.
 */
export const RETURN_DISPOSITIONS = ["restock", "damaged"] as const;
export type ReturnDisposition = (typeof RETURN_DISPOSITIONS)[number];

export const RETURN_DISPOSITION_LABELS: Record<ReturnDisposition, string> = {
  restock: "Resellable - put back into sellable stock",
  damaged: "Damaged - take in but write off, do not resell",
};

export const RETURN_DISPOSITION_HINTS: Record<ReturnDisposition, string> = {
  restock: "A RETURN movement adds the quantity back to sellable stock.",
  damaged:
    "A RETURN movement records the item arriving, then a DAMAGE movement writes it straight off, so sellable stock is unchanged and the loss is reportable.",
};

/** Actions the customer may take on their own request. */
export const RETURN_CUSTOMER_ACTIONS: ReturnAction[] = ["shipped", "cancel"];

/**
 * The tail a failed quality check runs through. A QC failure is not the end of
 * the story - the goods are still the customer's, so the timeline carries on
 * until they have them back.
 */
export const RETURN_SENDBACK_FLOW: ReturnStatus[] = [
  "qc_failed",
  "returning_to_customer",
  "returned_to_customer",
];

/** Ordered happy-path used to render "upcoming" steps in request timelines. */
export const RETURN_FLOW: ReturnStatus[] = [
  "return_requested",
  "under_review",
  "approved",
  "shipped_by_customer",
  "received",
  "refund_pending",
  "refunded",
];

// ── Return status copy ─────────────────────────────────────────────────────

/** Display names; `statusLabel` is too generic for the return-specific wording. */
export const RETURN_STATUS_LABELS: Record<string, string> = {
  return_requested: "Return Requested",
  under_review: "Under Review",
  approved: "Approved",
  pickup_scheduled: "Pickup Scheduled",
  picked_up: "Picked Up",
  shipped_by_customer: "Shipped by Customer",
  received: "Received",
  refund_pending: "Refund Pending",
  refunded: "Refunded",
  rejected: "Return Rejected",
  expired: "Return Expired",
  qc_failed: "QC Failed",
  returning_to_customer: "Sending Item Back",
  returned_to_customer: "Item Returned to Customer",
  cancelled: "Return Cancelled",
  closed: "Closed",
};

export function returnStatusLabel(status: string): string {
  return RETURN_STATUS_LABELS[status] ?? statusLabel(status);
}

/** Everything the status sentences interpolate. Missing values degrade quietly. */
export interface ReturnStatusContext {
  reason?: string | null;
  /** Courier / tracking for the leg back to the customer after a failed QC. */
  sendbackCourier?: string | null;
  sendbackTrackingNo?: string | null;
  deadline?: Date | string | null;
  courier?: string | null;
  trackingNo?: string | null;
  amount?: number | null;
  refundMode?: string | null;
  refNo?: string | null;
}

/** Indian grouping, so a refund reads as ₹1,499.00 rather than ₹1499.00. */
const MONEY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(amount: number | null | undefined): string {
  return typeof amount === "number" && Number.isFinite(amount)
    ? MONEY.format(amount)
    : "the refund amount";
}

function deadlineText(deadline: Date | string | null | undefined): string {
  if (!deadline) return "the stated deadline";
  const d = new Date(deadline);
  return Number.isNaN(d.getTime()) ? "the stated deadline" : formatStoreDate(d);
}

/** The line shown under a reached step in the customer's return timeline. */
export function returnStatusMessage(
  status: string,
  ctx: ReturnStatusContext = {}
): string {
  switch (status) {
    case "return_requested":
      return ctx.reason
        ? `Return request raised. Reason: ${ctx.reason}`
        : "Return request raised.";
    case "under_review":
      return "Your return request is being reviewed. This usually takes 24–48 hours.";
    case "approved":
      return `Return approved. Please ship the item to our address before ${deadlineText(ctx.deadline)}.`;
    case "pickup_scheduled":
    case "picked_up":
    case "shipped_by_customer": {
      const head = ctx.courier ? `Item shipped via ${ctx.courier}.` : "Item shipped.";
      return ctx.trackingNo ? `${head} Tracking no: ${ctx.trackingNo}` : head;
    }
    case "received":
      return "Returned item received. Quality check in progress.";
    case "refund_pending":
      return `Quality check passed. Refund of ${money(ctx.amount)} will be credited within 5–7 working days.`;
    case "refunded": {
      const mode = ctx.refundMode ? ` to ${ctx.refundMode}` : "";
      const ref = ctx.refNo ? ` Ref no: ${ctx.refNo}` : "";
      return `${money(ctx.amount)} refunded${mode}.${ref}`.trim();
    }
    case "rejected":
      return ctx.reason
        ? `Return request rejected. Reason: ${ctx.reason}`
        : "Return request rejected.";
    case "expired":
      return `Return closed as the item was not shipped before ${deadlineText(ctx.deadline)}.`;
    case "qc_failed":
      return ctx.reason
        ? `Returned item did not pass quality check. Reason: ${ctx.reason}. The item will be sent back to you.`
        : "Returned item did not pass quality check. The item will be sent back to you.";
    case "returning_to_customer": {
      const head = ctx.sendbackCourier
        ? `Item on its way back to you via ${ctx.sendbackCourier}.`
        : "Item on its way back to you.";
      return ctx.sendbackTrackingNo
        ? `${head} Tracking no: ${ctx.sendbackTrackingNo}`
        : head;
    }
    case "returned_to_customer":
      return "Item delivered back to you.";
    case "cancelled":
      return "Return request cancelled by customer.";
    case "closed":
      return "Return request closed.";
    default:
      return "";
  }
}

/**
 * Greyed-out hint under a step the request has not reached yet. The timeline
 * puts it on the next step only, never on the ones after it.
 */
export const RETURN_PENDING_HINTS: Record<string, string> = {
  under_review: "We’ll update you once reviewed",
  approved: "Awaiting approval",
  shipped_by_customer: "Add tracking details after shipping",
  received: "Awaiting item at our warehouse",
  refund_pending: "After quality check",
  refunded: "Refund will be processed after QC",
};

export function returnPendingHint(status: string): string | null {
  return RETURN_PENDING_HINTS[status] ?? null;
}

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
