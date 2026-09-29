"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/Toast";
import { formatDateTime, formatPrice } from "@/lib/utils";
import {
  availableActions,
  REPLACEMENT_TRANSITIONS,
  RETURN_TRANSITIONS,
} from "../lib/policy";
import {
  useAdminRequest,
  useAdminRequestAction,
  type RequestKind,
} from "../hooks/use-returns";
import { RequestStatusBadge } from "./RequestStatusBadge";

interface Props {
  kind: RequestKind;
  uuid: string | null;
  onClose: () => void;
}

type Pending = { action: string; label: string } | null;

export function AdminRequestDetailModal({ kind, uuid, onClose }: Props) {
  const { data: req, isLoading, error } = useAdminRequest(kind, uuid);
  const mutation = useAdminRequestAction(kind);
  const [pending, setPending] = useState<Pending>(null);
  const [comment, setComment] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const transitions = kind === "returns" ? RETURN_TRANSITIONS : REPLACEMENT_TRANSITIONS;
  const actions = req ? availableActions(transitions as Record<string, { from: readonly string[]; label: string }>, req.status) : [];

  const confirm = () => {
    if (!pending || !req) return;
    const isReject = pending.action === "reject";
    if (isReject && comment.trim().length < 3) {
      setFieldError("A rejection reason is required.");
      return;
    }
    setFieldError(null);
    mutation.mutate(
      {
        uuid: req.id,
        action: pending.action,
        payload: {
          ...(isReject ? { rejectionReason: comment.trim() } : comment.trim() ? { comment: comment.trim() } : {}),
          ...(pending.action === "pickup" && pickupDate ? { pickupDate: new Date(pickupDate).toISOString() } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(`${pending.label} completed`);
          setPending(null);
          setComment("");
          setPickupDate("");
        },
        onError: (err) => setFieldError(err instanceof Error ? err.message : "Action failed"),
      }
    );
  };

  return (
    <Modal
      open={Boolean(uuid)}
      onClose={onClose}
      title={kind === "returns" ? "Return request" : "Replacement request"}
      className="max-w-3xl"
    >
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 rounded-xl skeleton-shimmer" />
          <div className="h-40 rounded-xl skeleton-shimmer" />
        </div>
      ) : error || !req ? (
        <p className="py-6 text-center text-sm text-red-600">
          {(error as Error)?.message || "Request not found."}
        </p>
      ) : (
        <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs text-neutral-500">{req.id}</p>
            <RequestStatusBadge status={req.status} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Block title="Customer">
              <p className="font-semibold">{req.customer.name}</p>
              <p>{req.customer.email}</p>
              <p>{req.customer.phone}</p>
            </Block>
            <Block title="Order">
              <p className="font-mono font-semibold">{req.orderNumber}</p>
              <p>Status: {req.orderStatus}</p>
              <p>Delivered: {req.deliveredAt ? formatDateTime(req.deliveredAt) : "—"}</p>
              <p>
                {kind === "returns" ? "Return" : "Replacement"} deadline:{" "}
                {req.returnDeadline ? formatDateTime(req.returnDeadline) : "—"}
              </p>
              {req.orderTotal !== undefined && <p>Order total: {formatPrice(req.orderTotal)}</p>}
            </Block>
          </div>

          <Block title="Products">
            <ul className="space-y-2">
              {req.items.map((i) => (
                <li key={i.orderItemId} className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    {i.image && <Image src={i.image} alt={i.productName} fill sizes="48px" className="object-cover" unoptimized />}
                  </div>
                  <div>
                    <p className="font-semibold">{i.productName}</p>
                    <p className="text-xs text-neutral-500">
                      {[i.variantName, i.color && `Color: ${i.color}`, i.size && `Size: ${i.size}`]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · Qty {i.quantity} · {formatPrice(i.unitPrice)}
                    </p>
                    {i.requestedSize && (
                      <p className="text-xs font-semibold text-secondary-700">
                        Requested replacement size: {i.requestedSize}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Reason">
            <p className="font-semibold">{req.reason}</p>
            {req.description && <p className="mt-1 whitespace-pre-wrap">{req.description}</p>}
            <p className="mt-1 text-xs text-neutral-500">Requested {formatDateTime(req.requestedAt)}</p>
          </Block>

          {req.status === "rejected" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
              <strong>Rejection reason:</strong> {req.rejectionReason}
              {req.rejectedAt && <span className="block text-xs">{formatDateTime(req.rejectedAt)}</span>}
            </div>
          )}
          {req.adminComment && req.status !== "rejected" && (
            <Block title="Admin comment">
              <p>{req.adminComment}</p>
            </Block>
          )}

          <Block title="Unboxing video">
            {req.unboxingVideoUrl ? (
              <video src={req.unboxingVideoUrl} controls preload="metadata" className="max-h-72 w-full rounded-lg bg-black" />
            ) : (
              <p className="text-neutral-500">No video attached (legacy request).</p>
            )}
          </Block>

          <Block title="Request history">
            <ol className="space-y-1 text-xs">
              {req.history.map((h) => (
                <li key={h.id}>
                  <strong>{h.toStatus.replace(/_/g, " ")}</strong> · {formatDateTime(h.createdAt)} ·{" "}
                  <span className="text-neutral-500">{h.actorType}</span>
                  {h.note && <span className="text-neutral-600"> — {h.note}</span>}
                </li>
              ))}
              {req.history.length === 0 && <li className="text-neutral-500">No history yet.</li>}
            </ol>
          </Block>

          {actions.length > 0 && !pending && (
            <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
              {actions.map((a) => (
                <Button
                  key={a.action}
                  size="sm"
                  variant={a.action === "reject" ? "outline" : "default"}
                  className={a.action === "reject" ? "border-red-200 text-red-700 hover:bg-red-50" : ""}
                  onClick={() => {
                    setFieldError(null);
                    setPending(a);
                  }}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}

          {pending && (
            <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="font-semibold">
                {pending.action === "approve"
                  ? "Approve this request?"
                  : pending.action === "reject"
                    ? "Reject this request"
                    : `${pending.label}?`}
              </p>
              {pending.action === "pickup" && (
                <input
                  type="datetime-local"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                />
              )}
              <Textarea
                value={comment}
                maxLength={500}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  pending.action === "reject" ? "Rejection reason (required)" : "Comment (optional)"
                }
              />
              {fieldError && <p className="text-xs font-medium text-red-600">{fieldError}</p>}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setPending(null)} disabled={mutation.isPending}>
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={confirm}
                  disabled={mutation.isPending}
                  className={pending.action === "reject" ? "bg-red-600 text-white hover:bg-red-700" : ""}
                >
                  {mutation.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500">{title}</p>
      {children}
    </div>
  );
}
