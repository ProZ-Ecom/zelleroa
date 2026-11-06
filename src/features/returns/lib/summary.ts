import {
  isReturnExceptionStatus,
  REPLACEMENT_ACTIVE_STATUSES,
  REPLACEMENT_FLOW,
  RETURN_ACTIVE_STATUSES,
  RETURN_FLOW,
  RETURN_SENDBACK_FLOW,
  returnPendingHint,
  returnStatusLabel,
  returnStatusMessage,
  statusLabel,
  type ReplacementStatus,
  type ReturnStatus,
} from "./policy";

// ── Types shared by the order detail response and both request modules ─────

export type RequestKind = "return" | "replacement";

export interface RequestItemSummary {
  orderItemId: string;
  productName: string;
  variantName: string;
  size: string | null;
  color: string | null;
  image: string | null;
  quantity: number;
  unitPrice: number;
  /** Replacement only: the size the customer asked for. */
  requestedSize?: string | null;
  requestedVariantUnitPriceId?: string | null;
}

export interface RequestHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  action: string;
  note: string | null;
  actorType: string;
  createdAt: Date;
}

export interface RequestSummary {
  id: string;
  returnNumber?: string | null;
  kind: RequestKind;
  status: string;
  reason: string;
  description: string | null;
  unboxingVideoUrl: string | null;
  refundMethod?: string | null;
  bankAccountHolder?: string | null;
  bankName?: string | null;
  bankAccountLast4?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
  refundTransactionRef?: string | null;
  requestedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  adminComment: string | null;
  pickupScheduledAt: Date | null;
  /** Returns only: last day the customer may ship the item back. */
  shipDeadlineAt?: Date | null;
  shippedAt?: Date | null;
  receivedAt?: Date | null;
  qcFailedAt?: Date | null;
  qcFailureReason?: string | null;
  /** Returns only: the leg back to the customer after a failed check. */
  sendbackCourierName?: string | null;
  sendbackTrackingNumber?: string | null;
  sendbackShippedAt?: Date | null;
  sendbackProofUrl?: string | null;
  sendbackDeliveredAt?: Date | null;
  expiredAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  /** Returns only: the courier slip photo proving the parcel was posted. */
  shippingSlipUrl?: string | null;
  pickupImageUrl?: string | null;
  completedAt: Date | null;
  /** Returns only: total refundable value of the requested lines. */
  refundAmount?: number | null;
  items: RequestItemSummary[];
  history: RequestHistoryEntry[];
  /** Returns only: the step-by-step view the customer sees. */
  steps?: RequestStep[];
}

/** One row of the customer-facing return progress list. */
export interface RequestStep {
  status: string;
  label: string;
  state: "done" | "current" | "pending";
  /** Reached steps carry the status sentence; pending ones carry the hint. */
  description: string | null;
  hint: string | null;
  at: Date | null;
  tone: "default" | "danger" | "success";
}

export interface TimelineEvent {
  key: string;
  label: string;
  note: string | null;
  at: Date | null;
  state: "done" | "current" | "upcoming";
  tone: "default" | "danger" | "success";
  /** Groups events that belong to a return / replacement request. */
  group: string | null;
}

export interface CancellationInfo {
  cancelledAt: Date | null;
  reason: string | null;
  comment: string | null;
  cancelledBy: string | null;
}

export interface OrderRefundInfo {
  id: string;
  amount: number;
  status: string;
  processedAt: Date | null;
  createdAt: Date;
}

// ── Formatting helpers ────────────────────────────────────────────────────

function attr(attributes: unknown, name: string): string | null {
  if (!Array.isArray(attributes)) return null;
  const found = attributes.find(
    (a) => a && String(a.name).toLowerCase() === name.toLowerCase()
  );
  return found?.value ? String(found.value) : null;
}

export function summarizeOrderItem(orderItem: any): Omit<
  RequestItemSummary,
  "quantity" | "requestedSize" | "requestedVariantUnitPriceId"
> {
  const image =
    orderItem.variant?.product_variant_images?.[0]?.image_url ??
    orderItem.style?.images?.[0]?.image_url ??
    orderItem.product?.images?.[0]?.image_url ??
    null;
  return {
    orderItemId: orderItem.uuid || String(orderItem.id),
    productName: orderItem.product_name_snapshot,
    variantName: orderItem.variant_snapshot,
    size:
      attr(orderItem.attributes_snapshot, "Size") ??
      orderItem.variant_unit_price?.attribute_value?.value ??
      null,
    color: attr(orderItem.attributes_snapshot, "Color") ?? orderItem.variant?.color_name ?? null,
    image,
    unitPrice: Number(orderItem.unit_price),
  };
}

function sizeOfUnitPrice(vup: any): string | null {
  return vup?.attribute_value?.value ?? vup?.attribute_value?.name ?? null;
}

function mapHistory(rows: any[] | undefined): RequestHistoryEntry[] {
  return (rows ?? []).map((h) => ({
    id: String(h.id),
    fromStatus: h.from_status ?? null,
    toStatus: h.to_status,
    action: h.action,
    note: h.note ?? null,
    actorType: h.actor_type,
    createdAt: h.created_at,
  }));
}

// ── Item availability ──────────────────────────────────────────────────────

/**
 * Mirrors `findItemConflicts` in lib/guards.ts: a request holds on to its order
 * items while it is in flight or completed, and hands them back only when it
 * was rejected, expired or cancelled. Shared so the buttons the customer sees
 * cannot drift from the rule the server enforces on submit.
 */
export function isRequestConsuming(req: RequestSummary): boolean {
  const active: readonly string[] =
    req.kind === "return" ? RETURN_ACTIVE_STATUSES : REPLACEMENT_ACTIVE_STATUSES;
  if (active.includes(req.status)) return true;
  if (req.status === "closed") {
    return !req.rejectedAt && !req.cancelledAt && !req.expiredAt;
  }
  return false;
}

/** Order item ids that an in-flight or completed request already covers. */
export function consumedOrderItemIds(requests: RequestSummary[]): Set<string> {
  const ids = new Set<string>();
  for (const req of requests) {
    if (!isRequestConsuming(req)) continue;
    for (const item of req.items) ids.add(item.orderItemId);
  }
  return ids;
}

// ── Return progress steps ──────────────────────────────────────────────────

/** How the money went back, phrased for the customer. */
export function refundModeLabel(req: {
  refundMethod?: string | null;
  bankAccountLast4?: string | null;
  upiId?: string | null;
}): string | null {
  if (req.refundMethod === "bank_transfer") {
    return req.bankAccountLast4
      ? `your bank account ${req.bankAccountLast4}`
      : "your bank account";
  }
  if (req.refundMethod === "upi") {
    return req.upiId ? `UPI (${req.upiId})` : "your UPI ID";
  }
  return "the original payment method";
}

function stepTone(status: string): RequestStep["tone"] {
  if (isReturnExceptionStatus(status)) return "danger";
  if (status === "refunded") return "success";
  return "default";
}

/**
 * The customer's return progress list: every happy-path step the request has
 * reached, with its status sentence, then the step it is waiting on with a
 * greyed-out hint. When the request ended off the happy path, the exception is
 * appended and the remaining steps are dropped - there is nothing left to wait
 * for.
 */
export function buildReturnSteps(req: RequestSummary): RequestStep[] {
  const reachedAt = new Map<string, Date>();
  for (const h of [...req.history].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )) {
    if (!reachedAt.has(h.toStatus)) reachedAt.set(h.toStatus, h.createdAt);
  }
  // The row's own timestamps win where they exist - history can be thin on
  // requests created before the status columns did.
  const fallbacks: Array<[string, Date | null | undefined]> = [
    ["return_requested", req.requestedAt],
    ["approved", req.approvedAt],
    ["shipped_by_customer", req.shippedAt ?? req.pickupScheduledAt],
    ["received", req.receivedAt],
    ["refunded", req.completedAt],
    ["rejected", req.rejectedAt],
    ["qc_failed", req.qcFailedAt],
    ["returning_to_customer", req.sendbackShippedAt],
    ["returned_to_customer", req.sendbackDeliveredAt],
    ["expired", req.expiredAt],
    ["cancelled", req.cancelledAt],
  ];
  for (const [status, at] of fallbacks) {
    if (at && !reachedAt.has(status)) reachedAt.set(status, at);
  }
  // Retired pickup statuses are shown as the ship step on legacy requests.
  for (const legacy of ["pickup_scheduled", "picked_up"]) {
    const at = reachedAt.get(legacy);
    if (at && !reachedAt.has("shipped_by_customer")) {
      reachedAt.set("shipped_by_customer", at);
    }
  }

  const describe = (status: string): string =>
    returnStatusMessage(status, {
      reason:
        status === "rejected"
          ? req.rejectionReason
          : status === "qc_failed"
            ? req.qcFailureReason
            : status === "cancelled"
              ? req.cancellationReason
              : req.reason,
      deadline: req.shipDeadlineAt,
      courier: req.courierName,
      trackingNo: req.trackingNumber,
      sendbackCourier: req.sendbackCourierName,
      sendbackTrackingNo: req.sendbackTrackingNumber,
      amount: req.refundAmount,
      refundMode: refundModeLabel(req),
      refNo: req.refundTransactionRef,
    });

  // A request has self-evidently reached the status it is sitting on, even
  // where no history row or timestamp records it - older rows carry thin
  // history, and a step shown as still pending while the request is already
  // past it is the one mistake the customer would notice.
  const reached = new Set(reachedAt.keys());
  reached.add(req.status);

  const steps: RequestStep[] = [];
  const ended = isReturnExceptionStatus(req.status);
  // How far along the happy path the request actually is. A step the request
  // never visited but has already moved past was skipped (an approval with no
  // separate review), so it is dropped rather than shown as still coming -
  // otherwise the timeline claims "Under Review, in progress" on a request
  // that is already refunded.
  let lastReached = -1;
  RETURN_FLOW.forEach((status, idx) => {
    if (reached.has(status)) lastReached = idx;
  });
  let nextPending = true;

  RETURN_FLOW.forEach((status, idx) => {
    const at = reachedAt.get(status) ?? null;
    if (reached.has(status)) {
      steps.push({
        status,
        label: returnStatusLabel(status),
        state: "done",
        description: describe(status),
        hint: null,
        at,
        tone: stepTone(status),
      });
      return;
    }
    // Skipped, or - once the request has ended off the happy path - no longer
    // coming at all.
    if (ended || idx < lastReached) return;
    const isNext = nextPending;
    nextPending = false;
    steps.push({
      status,
      label: returnStatusLabel(status),
      state: isNext ? "current" : "pending",
      description: null,
      hint: isNext ? returnPendingHint(status) : null,
      at: null,
      tone: "default",
    });
  });

  if (ended) {
    // A failed check leaves the item with us but still owned by the customer,
    // so show the whole way back to them - not just the step it is sitting on.
    const inSendback = (RETURN_SENDBACK_FLOW as readonly string[]).includes(req.status);
    const tail = inSendback
      ? (RETURN_SENDBACK_FLOW as readonly string[]).filter(
          (s) => reached.has(s) || s === req.status
        )
      : [req.status];
    for (const status of tail) {
      steps.push({
        status,
        label: returnStatusLabel(status),
        state: "done",
        description: describe(status),
        hint: null,
        at: reachedAt.get(status) ?? null,
        // Getting the item back to the customer is the good ending of a bad
        // branch, so it is not painted as another failure.
        tone: status === "returned_to_customer" ? "default" : "danger",
      });
    }
  }

  return steps;
}

export function summarizeReturnRequest(req: any): RequestSummary {
  type ReturnLine = { refund_amount?: unknown; order_items?: { total_price?: unknown } };
  const refundAmount = ((req.return_items ?? []) as ReturnLine[]).reduce(
    (sum, ri) => sum + Number(ri.refund_amount ?? ri.order_items?.total_price ?? 0),
    0
  );
  const returnNumber =
    req.return_number ||
    (req.approved_at || (req.status && !["return_requested", "under_review", "rejected"].includes(req.status))
      ? `RET-${new Date(req.created_at || Date.now()).toISOString().slice(0, 10).replace(/-/g, "")}-${String(req.id).padStart(4, "0")}`
      : null);

  const summary: RequestSummary = {
    id: req.uuid || String(req.id),
    returnNumber,
    kind: "return",
    status: req.status,
    reason: req.reason,
    description: req.description ?? null,
    unboxingVideoUrl: req.unboxing_video_url ?? null,
    refundMethod: req.refund_method ?? null,
    bankAccountHolder: req.bank_account_holder ?? null,
    bankName: req.bank_name ?? null,
    bankAccountLast4: req.bank_account_last4 ? `••••${req.bank_account_last4}` : null,
    bankIfsc: req.bank_ifsc ?? null,
    upiId: req.upi_id ?? null,
    refundTransactionRef: req.refund_transaction_ref ?? null,
    requestedAt: req.requested_at,
    approvedAt: req.approved_at ?? null,
    rejectedAt: req.rejected_at ?? null,
    rejectionReason: req.rejection_reason ?? null,
    adminComment: req.admin_comment ?? null,
    pickupScheduledAt: req.pickup_scheduled_at ?? null,
    shipDeadlineAt: req.ship_deadline_at ?? null,
    shippedAt: req.shipped_at ?? null,
    receivedAt: req.received_at ?? null,
    qcFailedAt: req.qc_failed_at ?? null,
    qcFailureReason: req.qc_failure_reason ?? null,
    sendbackCourierName: req.sendback_courier_name ?? null,
    sendbackTrackingNumber: req.sendback_tracking_number ?? null,
    sendbackShippedAt: req.sendback_shipped_at ?? null,
    sendbackProofUrl: req.sendback_proof_url ?? null,
    sendbackDeliveredAt: req.sendback_delivered_at ?? null,
    expiredAt: req.expired_at ?? null,
    cancelledAt: req.cancelled_at ?? null,
    cancellationReason: req.cancellation_reason ?? null,
    courierName: req.courier_name ?? null,
    trackingNumber: req.tracking_number ?? null,
    shippingSlipUrl: req.shipping_slip_url ?? null,
    pickupImageUrl: req.pickup_image_url ?? null,
    completedAt: req.completed_at ?? null,
    refundAmount,
    items: (req.return_items ?? []).map((ri: any) => ({
      ...summarizeOrderItem(ri.order_items),
      quantity: ri.quantity,
    })),
    history: mapHistory(req.history),
  };
  return { ...summary, steps: buildReturnSteps(summary) };
}

export function summarizeReplacementRequest(req: any): RequestSummary {
  const replacementNumber =
    req.replacement_number ||
    (req.approved_at || (req.status && !["replacement_requested", "under_review", "rejected"].includes(req.status))
      ? `REP-${new Date(req.created_at || Date.now()).toISOString().slice(0, 10).replace(/-/g, "")}-${String(req.id).padStart(4, "0")}`
      : null);

  return {
    id: req.uuid || String(req.id),
    returnNumber: replacementNumber,
    kind: "replacement",
    status: req.status,
    reason: req.reason,
    description: req.description ?? null,
    unboxingVideoUrl: req.unboxing_video_url ?? null,
    refundMethod: null,
    bankAccountHolder: null,
    bankName: null,
    bankAccountLast4: null,
    bankIfsc: null,
    upiId: null,
    refundTransactionRef: null,
    requestedAt: req.requested_at,
    approvedAt: req.approved_at ?? null,
    rejectedAt: req.rejected_at ?? null,
    rejectionReason: req.rejection_reason ?? null,
    adminComment: req.admin_comment ?? null,
    pickupScheduledAt: req.pickup_scheduled_at ?? null,
    courierName: req.courier_name ?? null,
    trackingNumber: req.tracking_number ?? null,
    pickupImageUrl: req.pickup_image_url ?? null,
    completedAt: req.completed_at ?? null,
    items: (req.items ?? []).map((ri: any) => ({
      ...summarizeOrderItem(ri.order_items),
      quantity: ri.quantity,
      requestedSize: sizeOfUnitPrice(ri.requested_variant_unit_price),
      requestedVariantUnitPriceId:
        ri.requested_variant_unit_price?.uuid ??
        (ri.requested_variant_unit_price_id ? String(ri.requested_variant_unit_price_id) : null),
    })),
    history: mapHistory(req.history),
  };
}

// ── Order timeline ─────────────────────────────────────────────────────────

const ORDER_STEP_LABELS: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Order Cancelled",
  returned: "Returned",
};

const ORDER_FLOW = [
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

function requestEventLabel(kind: RequestKind, status: string): string {
  if (kind === "return") return returnStatusLabel(status);
  if (status === "replacement_requested") return "Replacement Requested";
  if (status === "replaced") return "Replacement Delivered";
  return statusLabel(status);
}

function toneFor(status: string): TimelineEvent["tone"] {
  if (isReturnExceptionStatus(status)) return "danger";
  if (["refunded", "replaced", "delivered", "closed"].includes(status)) return "success";
  return "default";
}

export function buildOrderTimeline(input: {
  orderStatus: string;
  placedAt: Date;
  paymentStatus: string;
  paymentConfirmedAt: Date | null;
  statusHistory: Array<{ status: string; note: string | null; created_at: Date }>;
  requests: RequestSummary[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    key: "placed",
    label: "Order Placed",
    note: null,
    at: input.placedAt,
    state: "done",
    tone: "default",
    group: null,
  });

  if (
    input.paymentConfirmedAt &&
    ["paid", "refunded", "partial_refund"].includes(input.paymentStatus)
  ) {
    events.push({
      key: "payment",
      label: "Payment Confirmed",
      note: null,
      at: input.paymentConfirmedAt,
      state: "done",
      tone: "default",
      group: null,
    });
  }

  const seen = new Set<string>();
  const ordered = [...input.statusHistory].sort(
    (a, b) => a.created_at.getTime() - b.created_at.getTime()
  );
  for (let idx = 0; idx < ordered.length; idx++) {
    const row = ordered[idx];
    // "pending" is Order Placed; refund bookkeeping rows reuse the returned status.
    if (row.status === "pending") continue;
    const rowId = (row as any).id ?? idx;
    const key = `order-${row.status}-${rowId}-${row.created_at.getTime()}`;
    if (row.status === "returned" && row.note?.startsWith("Refund")) continue;
    seen.add(row.status);
    events.push({
      key,
      label: ORDER_STEP_LABELS[row.status] ?? statusLabel(row.status),
      note: row.note,
      at: row.created_at,
      state: "done",
      tone: toneFor(row.status),
      group: null,
    });
  }

  const orderClosed = ["cancelled", "returned"].includes(input.orderStatus);
  if (!orderClosed) {
    const reachedIdx = Math.max(
      -1,
      ORDER_FLOW.indexOf(input.orderStatus),
      ...[...seen].map((s) => ORDER_FLOW.indexOf(s))
    );
    const upcoming = ORDER_FLOW.slice(reachedIdx + 1);
    upcoming.forEach((s, i) => {
      events.push({
        key: `upcoming-${s}`,
        label: ORDER_STEP_LABELS[s],
        note: null,
        at: null,
        state: i === 0 ? "current" : "upcoming",
        tone: "default",
        group: null,
      });
    });
  }

  for (const req of input.requests) {
    const flow: string[] =
      req.kind === "return" ? RETURN_FLOW : REPLACEMENT_FLOW;
    const group = `${req.kind === "return" ? "Return" : "Replacement"} request`;
    const reached = new Set<string>();
    const sortedHistory = [...req.history].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    for (const h of sortedHistory) {
      reached.add(h.toStatus);
      events.push({
        key: `${req.kind}-${req.id}-${h.id}`,
        label: requestEventLabel(req.kind, h.toStatus),
        note: h.toStatus === "rejected" ? req.rejectionReason ?? h.note : h.note,
        at: h.createdAt,
        state: "done",
        tone: toneFor(h.toStatus),
        group,
      });
    }
    // Nothing is pending once the request ended, on or off the happy path.
    const terminal = req.status === "closed" || isReturnExceptionStatus(req.status);
    if (!terminal) {
      const lastIdx = Math.max(-1, ...[...reached].map((s) => flow.indexOf(s)));
      flow.slice(lastIdx + 1).forEach((s, i) => {
        events.push({
          key: `${req.kind}-${req.id}-upcoming-${s}`,
          label: requestEventLabel(req.kind, s),
          note: null,
          at: null,
          state: i === 0 ? "current" : "upcoming",
          tone: "default",
          group,
        });
      });
    }
  }

  // Chronological order for finished events; upcoming steps stay at the end
  // in the order they were generated.
  const done = events
    .filter((e) => e.state === "done")
    .sort((a, b) => a.at!.getTime() - b.at!.getTime());
  const rest = events.filter((e) => e.state !== "done");
  return [...done, ...rest];
}

export type { ReplacementStatus, ReturnStatus };
