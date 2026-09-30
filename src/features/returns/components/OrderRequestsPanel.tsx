"use client";

import { AlertCircle, ChevronDown, Repeat2, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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

function RequestCard({ req }: { req: RequestSummary }) {
  const [open, setOpen] = useState(false);
  const label = req.kind === "return" ? "Return" : "Replacement";

  return (
    <li className="rounded-xl border border-theme-border bg-theme-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-theme-text-primary">
            {label} request · {req.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
          </p>
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
              <RequestCard key={`${r.kind}-${r.id}`} req={r} />
            ))}
          </ul>
        ) : (
          !showActions && <p className="text-xs text-theme-text-subtle">No return or replacement requests.</p>
        )}
      </div>
    </div>
  );
}
