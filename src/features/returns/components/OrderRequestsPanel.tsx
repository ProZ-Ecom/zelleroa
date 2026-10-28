"use client";

import { AlertCircle, ChevronDown, Repeat2, Undo2, Copy, Check, CheckCircle2, MapPin, Truck, ExternalLink, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";
import type { OrderDetailResponse } from "@/features/orders/types";
import type { RequestSummary } from "../lib/summary";
import { RequestStatusBadge } from "./RequestStatusBadge";

interface Props {
  order: OrderDetailResponse;
  /** Customer view shows action buttons; admin view is read-only. */
  onRequest?: (mode: "return" | "replacement") => void;
  readOnly?: boolean;
}

function RequestCard({ req, order }: { req: RequestSummary; order: OrderDetailResponse }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedTrack, setCopiedTrack] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const label = req.kind === "return" ? "Return" : "Replacement";

  return (
    <li className="rounded-xl border border-theme-border bg-theme-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-theme-text-primary">
              {label} request · {req.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
            </p>
            {req.returnNumber && (
              <span className="font-mono text-xs font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                ID: {req.returnNumber}
              </span>
            )}
          </div>
          <p className="text-xs text-theme-text-subtle">Requested {formatDateTime(req.requestedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <RequestStatusBadge status={req.status} />
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {req.status === "rejected" && req.rejectionReason && (
        <div className="mx-4 mb-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Rejected:</strong> {req.rejectionReason}
          </span>
        </div>
      )}

      {open && (
        <div className="space-y-3 border-t border-theme-border-subtle px-4 py-3 text-sm">
          {req.returnNumber && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-sm text-emerald-950">{label} Approved</p>
                    <p className="text-[11px] text-emerald-800">
                      Official Return ID generated. Please keep this ID ready during courier pickup.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs bg-white px-2.5 py-1 rounded-md border border-emerald-200 shadow-2xs">
                    {req.returnNumber}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(req.returnNumber!);
                      setCopied(true);
                      toast.success("Return ID copied");
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {order.shippingAddress && (
                <div className="mt-1 rounded-lg bg-white/90 p-2.5 border border-emerald-200/90 text-xs text-neutral-800 flex items-start gap-2 shadow-2xs">
                  <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-emerald-950 text-[11px] uppercase tracking-wide">Pickup Location (Customer Address)</p>
                    <p className="font-semibold text-neutral-900 mt-0.5">{order.shippingAddress.fullName} · {order.shippingAddress.phone}</p>
                    <p className="text-neutral-600 text-[11px]">
                      {order.shippingAddress.addressLine1}
                      {order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ""}
                      {order.shippingAddress.landmark ? ` (Landmark: ${order.shippingAddress.landmark})` : ""}
                    </p>
                    <p className="text-neutral-700 text-[11px] font-medium">
                      {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {(req.courierName || req.trackingNumber || req.pickupImageUrl) && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs text-sky-950">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-sky-700 shrink-0" />
                  <p className="font-bold text-xs text-sky-950 uppercase tracking-wide">
                    Courier &amp; Pickup Tracking
                  </p>
                </div>
                {order.courierShipment?.trackingNumber && req.trackingNumber && req.trackingNumber.toUpperCase() === order.courierShipment.trackingNumber.toUpperCase() && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-200">
                    <Check className="h-3 w-3 text-emerald-600" /> Verified Delivery Match
                  </span>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {req.courierName && (
                  <div>
                    <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">
                      Courier / Partner
                    </span>
                    <p className="font-semibold text-neutral-900 mt-0.5">{req.courierName}</p>
                  </div>
                )}
                {req.trackingNumber && (
                  <div>
                    <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">
                      Tracker ID / AWB No
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-sky-950 bg-white px-2 py-0.5 rounded border border-sky-200 shadow-2xs">
                        {req.trackingNumber}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(req.trackingNumber!);
                          setCopiedTrack(true);
                          toast.success("Tracker ID copied");
                          setTimeout(() => setCopiedTrack(false), 2000);
                        }}
                        className="text-sky-700 hover:text-sky-900 p-0.5 cursor-pointer"
                        title="Copy Tracker ID"
                      >
                        {copiedTrack ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
                {req.pickupImageUrl && (
                  <div>
                    <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">
                      Pickup Proof / Receipt
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(req.pickupImageUrl!);
                      }}
                      className="group relative mt-1 flex items-center gap-2 rounded-lg border border-sky-200 bg-white p-1 text-sky-800 hover:bg-sky-100 transition-colors cursor-pointer"
                    >
                      <div className="relative h-9 w-9 overflow-hidden rounded bg-neutral-100 border border-neutral-200 shrink-0">
                        <Image src={req.pickupImageUrl} alt="Pickup proof" fill sizes="36px" className="object-cover" unoptimized />
                      </div>
                      <span className="text-[11px] font-semibold pr-1">View photo</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <p>
            <span className="font-semibold">Reason:</span> {req.reason}
          </p>
          {req.description && (
            <p>
              <span className="font-semibold">Comments:</span> {req.description}
            </p>
          )}
          {req.items.some((i) => i.requestedSize) && (
            <p className="text-xs text-theme-text-muted">
              {req.items
                .filter((i) => i.requestedSize)
                .map((i) => `${i.productName}: ${i.size ?? "—"} → ${i.requestedSize}`)
                .join(" · ")}
            </p>
          )}
          {req.adminComment && req.status !== "rejected" && (
            <p className="text-xs text-theme-text-muted">
              <span className="font-semibold">Note from our team:</span> {req.adminComment}
            </p>
          )}
          {req.unboxingVideoUrl && (
            <video
              src={req.unboxingVideoUrl}
              controls
              preload="metadata"
              className="max-h-56 rounded-lg bg-black"
            />
          )}
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-theme-text-muted">History</p>
            <ul className="space-y-1 text-xs">
              {req.history.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-2">
                  <span className="font-semibold">{h.toStatus.replace(/_/g, " ")}</span>
                  <span className="text-theme-text-subtle">{formatDateTime(h.createdAt)}</span>
                  {h.note && <span className="text-theme-text-muted">— {h.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh] p-2 bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 z-10 rounded-full bg-black/60 text-white p-1.5 hover:bg-black/80 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative w-[80vw] max-w-lg h-[55vh] max-h-[460px]">
              <Image src={previewImage} alt="Pickup proof enlarged" fill className="object-contain" unoptimized />
            </div>
            <div className="p-2 text-center">
              <a
                href={previewImage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
              >
                Open original in new tab <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export function OrderRequestsPanel({ order, onRequest, readOnly }: Props) {
  const requests = [...(order.returnRequests ?? []), ...(order.replacementRequests ?? [])].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
  const win = order.returnWindow;
  const showActions = !readOnly && order.status === "delivered" && win;
  const hasContent = showActions || requests.length > 0;
  if (!hasContent) return null;

  return (
    <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-2xs overflow-hidden">
      <div className="bg-theme-surface-alt border-b border-theme-border-subtle px-5 py-3.5">
        <h2 className="text-sm sm:text-base font-bold text-theme-text-primary flex items-center gap-2">
          <Undo2 className="h-4 w-4 text-theme-secondary" />
          Returns &amp; Replacements
        </h2>
      </div>
      <div className="space-y-4 p-5">
        {showActions &&
          (win!.eligible ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-medium text-emerald-800">
                {win!.message} An unboxing video is mandatory.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onRequest?.("return")}>
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Request Return
                </Button>
                <Button size="sm" variant="outline" onClick={() => onRequest?.("replacement")}>
                  <Repeat2 className="mr-1.5 h-3.5 w-3.5" /> Request Replacement
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              Return period expired
            </p>
          ))}

        {requests.length > 0 ? (
          <ul className="space-y-2">
            {requests.map((r) => (
              <RequestCard key={`${r.kind}-${r.id}`} req={r} order={order} />
            ))}
          </ul>
        ) : (
          !showActions && <p className="text-xs text-theme-text-subtle">No return or replacement requests.</p>
        )}
      </div>
    </div>
  );
}

