import {
  REPLACEMENT_FLOW,
  RETURN_FLOW,
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
  kind: RequestKind;
  status: string;
  reason: string;
  description: string | null;
  unboxingVideoUrl: string | null;
  requestedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  adminComment: string | null;
  pickupScheduledAt: Date | null;
  completedAt: Date | null;
  items: RequestItemSummary[];
  history: RequestHistoryEntry[];
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

export function summarizeReturnRequest(req: any): RequestSummary {
  return {
    id: req.uuid || String(req.id),
    kind: "return",
    status: req.status,
    reason: req.reason,
    description: req.description ?? null,
    unboxingVideoUrl: req.unboxing_video_url ?? null,
    requestedAt: req.requested_at,
    approvedAt: req.approved_at ?? null,
    rejectedAt: req.rejected_at ?? null,
    rejectionReason: req.rejection_reason ?? null,
    adminComment: req.admin_comment ?? null,
    pickupScheduledAt: req.pickup_scheduled_at ?? null,
    completedAt: req.completed_at ?? null,
    items: (req.return_items ?? []).map((ri: any) => ({
      ...summarizeOrderItem(ri.order_items),
      quantity: ri.quantity,
    })),
    history: mapHistory(req.history),
  };
}

export function summarizeReplacementRequest(req: any): RequestSummary {
  return {
    id: req.uuid || String(req.id),
    kind: "replacement",
    status: req.status,
    reason: req.reason,
    description: req.description ?? null,
    unboxingVideoUrl: req.unboxing_video_url ?? null,
    requestedAt: req.requested_at,
    approvedAt: req.approved_at ?? null,
    rejectedAt: req.rejected_at ?? null,
    rejectionReason: req.rejection_reason ?? null,
    adminComment: req.admin_comment ?? null,
    pickupScheduledAt: req.pickup_scheduled_at ?? null,
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
  if (status === "return_requested") return "Return Requested";
  if (status === "replacement_requested") return "Replacement Requested";
  if (status === "replaced") return "Replacement Delivered";
  return statusLabel(status);
}

function toneFor(status: string): TimelineEvent["tone"] {
  if (status === "rejected" || status === "cancelled") return "danger";
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
  for (const row of ordered) {
    // "pending" is Order Placed; refund bookkeeping rows reuse the returned status.
    if (row.status === "pending") continue;
    const key = `order-${row.status}-${row.created_at.getTime()}`;
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
    const terminal = ["rejected", "closed"].includes(req.status);
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
