"use client";

import {
  MapPin,
  CreditCard,
  Truck,
  CalendarDays,
  User,
  Clock,
  FileText,
  Loader2,
  Package,
  Phone,
  Mail,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { OrderItemsList } from "./OrderItemsList";
import { OrderTotals } from "./OrderTotals";
import { OrderRequestsPanel } from "@/features/returns/components/OrderRequestsPanel";
import { OrderTimeline } from "@/features/returns/components/OrderTimeline";
import type { OrderDetailResponse, OrderDetail } from "../types";

interface OrderDetailViewProps {
  order: OrderDetailResponse | OrderDetail;
  onCancel?: () => void;
  isCancelling?: boolean;
  canCancel?: boolean;
  /** Opens the return / replacement wizard (customer view). */
  onRequest?: (mode: "return" | "replacement") => void;
  /** Admin view: no customer actions. */
  readOnly?: boolean;
}

function getStatusBadgeMeta(status?: string) {
  switch (status?.toLowerCase()) {
    case "delivered":
      return {
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "cancelled":
      return {
        bg: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-500",
      };
    case "returned":
      return {
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        dot: "bg-purple-500",
      };
    case "out_for_delivery":
    case "shipped":
      return {
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
      };
    case "packed":
    case "processing":
      return {
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      };
    case "pending":
    case "confirmed":
      return {
        bg: "bg-orange-50 text-orange-700 border-orange-200",
        dot: "bg-orange-500",
      };
    default:
      return {
        bg: "bg-theme-surface-alt text-theme-text-muted border-theme-border",
        dot: "bg-theme-border",
      };
  }
}

export function OrderDetailView({
  order,
  onCancel,
  isCancelling = false,
  canCancel = false,
  onRequest,
  readOnly = false,
}: OrderDetailViewProps) {
  const shippingAddress =
    ("shippingAddress" in order ? order.shippingAddress : (order as any).address) ||
    null;
  const billingAddress =
    ("billingAddress" in order ? order.billingAddress : null) || null;
  const customer = "customer" in order ? order.customer : (order as any).user;
  const shippingCharge =
    "shippingCharge" in order
      ? order.shippingCharge
      : (order as any).shippingAmount || 0;
  const statusHistory =
    "statusHistory" in order ? order.statusHistory || [] : [];
  const delivery = "delivery" in order ? order.delivery : (order as any).delivery;
  const courierShipment =
    "courierShipment" in order ? order.courierShipment : (order as any).courierShipment;

  const statusMeta = getStatusBadgeMeta(order.status);
  const paymentStatus = (order as any).paymentStatus || (order as any).payment_status;

  const formattedDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="space-y-6">
      {/* Top Details Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-theme-border-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-theme-text-primary font-mono tracking-tight">
              {order.orderNumber}
            </h1>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-theme-text-subtle font-medium">
            <CalendarDays className="h-3.5 w-3.5 text-theme-text-muted" />
            Placed on {formattedDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Order Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusMeta.bg}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
            {String(order.status).replace(/_/g, " ")}
          </span>

          {/* Payment Status Badge */}
          {paymentStatus && (
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                paymentStatus.toLowerCase() === "paid"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {paymentStatus}
            </span>
          )}

          {/* Download Invoice */}
          <Link href={`/invoice/${order.id}`} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-semibold min-h-[36px]"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Download Invoice
            </Button>
          </Link>

          {/* Cancel Order Action */}
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-700 border-red-200 hover:bg-red-50 rounded-xl text-xs font-semibold min-h-[36px]"
              onClick={onCancel}
              disabled={isCancelling}
            >
              {isCancelling && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* Main Content (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Order Items Card */}
          <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
            <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-theme-text-primary flex items-center gap-2">
                <Package className="h-4 w-4 text-theme-secondary" />
                Order Items ({order.items?.length || 0})
              </h2>
            </div>
            <div className="p-5">
              <OrderItemsList items={order.items || []} />
            </div>
          </div>

          {/* 2. Three Info Cards: Customer, Address & Staff */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Customer Details */}
            {customer && (
              <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
                <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-4 py-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-theme-secondary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-primary">
                    Customer Details
                  </h3>
                </div>
                <div className="p-4 text-xs space-y-1 text-theme-text-subtle">
                  <p className="font-bold text-theme-text-primary text-sm">
                    {customer.name || "Customer"}
                  </p>
                  {customer.customerId && (
                    <p className="font-mono text-[11px] text-theme-text-muted">
                      ID: {customer.customerId}
                    </p>
                  )}
                  {customer.email && (
                    <p className="flex items-center gap-1.5 truncate pt-0.5">
                      <Mail className="h-3 w-3 shrink-0 text-theme-text-muted" />
                      <span className="truncate">{customer.email}</span>
                    </p>
                  )}
                  {customer.phone && (
                    <p className="flex items-center gap-1.5 pt-0.5">
                      <Phone className="h-3 w-3 shrink-0 text-theme-text-muted" />
                      <span>{customer.phone}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Delivery Address */}
            {shippingAddress && (
              <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
                <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-4 py-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-theme-secondary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-primary">
                    Delivery Address
                  </h3>
                </div>
                <div className="p-4 text-xs text-theme-text-subtle space-y-1">
                  <p className="font-bold text-theme-text-primary text-sm">
                    {shippingAddress.fullName}
                  </p>
                  <p className="line-clamp-2">
                    {shippingAddress.addressLine1}
                    {shippingAddress.addressLine2
                      ? `, ${shippingAddress.addressLine2}`
                      : ""}
                  </p>
                  {shippingAddress.landmark && (
                    <p className="text-[11px] text-theme-text-muted">
                      Landmark: {shippingAddress.landmark}
                    </p>
                  )}
                  <p>
                    {shippingAddress.city}, {shippingAddress.state}{" "}
                    {shippingAddress.pincode ? `- ${shippingAddress.pincode}` : ""}
                  </p>
                  <p>{shippingAddress.country || "India"}</p>
                  {shippingAddress.phone && (
                    <p className="flex items-center gap-1.5 text-theme-text-muted pt-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{shippingAddress.phone}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Referral & commission (admin only - the API sends this for admin requests only) */}
            {"referral" in order && order.referral && (
              <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
                <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-4 py-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-primary">
                    Referral &amp; Commission
                  </h3>
                </div>
                <dl className="p-4 text-xs grid grid-cols-2 gap-x-3 gap-y-2">
                  <dt className="text-theme-text-muted">Referral code</dt>
                  <dd className="font-mono font-semibold text-theme-text-primary text-right">{order.referral.referralCode ?? "—"}</dd>
                  <dt className="text-theme-text-muted">Referred Sales Partner</dt>
                  <dd className="font-semibold text-theme-text-primary text-right">
                    {order.referral.agentName}
                    {order.referral.agentCode ? ` (${order.referral.agentCode})` : ""}
                  </dd>
                  <dt className="text-theme-text-muted">Commission %</dt>
                  <dd className="font-semibold text-theme-text-primary text-right">{order.referral.commissionPercentage}%</dd>
                  <dt className="text-theme-text-muted">Commission amount</dt>
                  <dd className="font-semibold text-theme-text-primary text-right">{formatPrice(order.referral.commissionAmount)}</dd>
                  <dt className="text-theme-text-muted">Commission status</dt>
                  <dd className="font-semibold capitalize text-theme-text-primary text-right">
                    {order.referral.commissionStatus.replace(/_/g, " ")}
                  </dd>
                </dl>
              </div>
            )}

            {/* Assigned Delivery Staff */}
            <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
              <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-4 py-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-theme-secondary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-primary">
                  Assigned Staff
                </h3>
              </div>
              <div className="p-4 text-xs space-y-2 text-theme-text-subtle">
                {delivery?.staff ? (
                  <>
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-theme-surface-alt border border-theme-border text-theme-primary text-xs font-bold shrink-0">
                        {delivery.staff.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-theme-text-primary truncate">
                          {delivery.staff.name}
                        </p>
                        {delivery.assignmentStatus && (
                          <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded capitalize">
                            {delivery.assignmentStatus.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {delivery.staff.phone && (
                      <p className="flex items-center gap-1.5 text-xs text-theme-text-muted">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="font-mono">{delivery.staff.phone}</span>
                      </p>
                    )}
                    {delivery.staff.email && (
                      <p className="text-xs truncate text-theme-text-muted">
                        {delivery.staff.email}
                      </p>
                    )}
                    {delivery.assignedAt && (
                      <p className="text-[11px] text-theme-text-muted pt-1">
                        Assigned on {formatDateTime(delivery.assignedAt)}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="py-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-theme-text-muted bg-theme-surface-alt px-2.5 py-0.5 rounded-full border border-theme-border">
                      Unassigned
                    </span>
                    <p className="text-xs text-theme-text-muted mt-2">
                      No delivery staff assigned yet. Kitchen is packaging your order.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Courier Shipment Tracking */}
            {courierShipment && (
              <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
                <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-4 py-3 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-theme-secondary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-primary">
                    Shipment Tracking
                  </h3>
                </div>
                <div className="p-4 text-xs space-y-2 text-theme-text-subtle">
                  <p className="font-bold text-theme-text-primary">
                    {courierShipment.carrier}
                  </p>
                  <p className="font-mono text-theme-text-muted">
                    AWB: {courierShipment.trackingNumber}
                  </p>
                  <span className="inline-block text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded capitalize">
                    {courierShipment.status.replace(/_/g, " ")}
                  </span>
                  {courierShipment.trackingUrl && (
                    <a
                      href={courierShipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs font-semibold text-theme-primary hover:underline pt-1"
                    >
                      Track on carrier site →
                    </a>
                  )}
                  {courierShipment.timeline?.length > 0 && (
                    <ul className="pt-2 space-y-1.5 border-t border-theme-border-subtle mt-2">
                      {courierShipment.timeline
                        .slice()
                        .reverse()
                        .map((event: any, idx: number) => (
                          <li key={idx} className="text-[11px] text-theme-text-muted">
                            <span className="font-semibold text-theme-text-secondary capitalize">
                              {event.status.replace(/_/g, " ")}
                            </span>
                            {event.location ? ` — ${event.location}` : ""}
                            <span className="block">
                              {formatDateTime(event.trackedAt)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Order Notes */}
          {order.notes && (
            <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
              <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-4 py-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-theme-secondary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-primary">
                  Order Notes & Instructions
                </h3>
              </div>
              <div className="p-4 text-xs text-theme-text-secondary">
                <p className="italic bg-theme-surface-warm p-3 rounded-xl border border-theme-border">
                  &ldquo;{order.notes}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Cancellation details + refund status */}
          {"cancellation" in order && order.cancellation && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 space-y-1">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Order cancelled
              </h3>
              <p>
                <span className="font-semibold">Reason:</span> {order.cancellation.reason || "—"}
              </p>
              {order.cancellation.comment && (
                <p>
                  <span className="font-semibold">Comment:</span> {order.cancellation.comment}
                </p>
              )}
              <p className="text-xs">
                Cancelled {order.cancellation.cancelledAt ? formatDateTime(order.cancellation.cancelledAt) : ""}
                {order.cancellation.cancelledBy ? ` by ${order.cancellation.cancelledBy}` : ""}
              </p>
              {(order.refunds ?? []).length > 0 &&
                order.refunds!.map((r) => (
                  <p key={r.id} className="text-xs font-semibold">
                    Refund of {formatPrice(r.amount)}: {r.status}
                  </p>
                ))}
            </div>
          )}

          {/* Returns & replacements */}
          {"returnRequests" in order && (
            <OrderRequestsPanel order={order as OrderDetailResponse} onRequest={onRequest} readOnly={readOnly} />
          )}

          {/* Full order + return/replacement timeline */}
          {"timeline" in order && order.timeline && order.timeline.length > 0 && (
            <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
              <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-5 py-3.5 flex items-center gap-2">
                <Clock className="h-4 w-4 text-theme-secondary" />
                <h3 className="text-sm font-bold text-theme-text-primary">Order Status Timeline</h3>
              </div>
              <div className="p-5">
                <OrderTimeline events={order.timeline} />
              </div>
            </div>
          )}

          {/* Status History Timeline (fallback when no computed timeline) */}
          {!("timeline" in order && order.timeline?.length) && statusHistory.length > 0 && (
            <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
              <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-5 py-3.5 flex items-center gap-2">
                <Clock className="h-4 w-4 text-theme-secondary" />
                <h3 className="text-sm font-bold text-theme-text-primary">
                  Order Timeline & Updates
                </h3>
              </div>
              <div className="p-5 space-y-3 divide-y divide-theme-border-subtle">
                {statusHistory.map((item, idx) => {
                  const itemStatusMeta = getStatusBadgeMeta(item.status);
                  return (
                    <div
                      key={item.id || idx}
                      className="flex items-start gap-3 pt-3 first:pt-0 text-xs"
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${itemStatusMeta.bg}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${itemStatusMeta.dot}`} />
                        {item.status.replace(/_/g, " ")}
                      </span>

                      <div className="flex-1 min-w-0">
                        {item.note && (
                          <p className="text-theme-text-primary font-medium">
                            {item.note}
                          </p>
                        )}
                        <p className="text-[11px] text-theme-text-muted mt-0.5">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Order Totals Summary (Sticky) */}
        <div className="sticky top-24">
          <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
            <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-5 py-3.5">
              <h2 className="text-sm sm:text-base font-bold text-theme-text-primary">
                Order Summary
              </h2>
            </div>
            <div className="p-5">
              <OrderTotals
                totals={{
                  subtotal: Number(order.subtotal || 0),
                  taxAmount: Number(order.taxAmount || 0),
                  shippingAmount: Number(shippingCharge || 0),
                  discountAmount: Number(order.discountAmount || 0),
                  totalAmount: Number(order.totalAmount || 0),
                }}
                couponLabel={(order as any).couponCode}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
