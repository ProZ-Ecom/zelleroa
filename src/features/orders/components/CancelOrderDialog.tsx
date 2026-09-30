"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CANCELLATION_REASONS } from "@/features/returns/lib/policy";

interface CancelOrderDialogProps {
  open: boolean;
  orderNumber: string;
  isPaid: boolean;
  isSubmitting: boolean;
  serverError?: string | null;
  onClose: () => void;
  onConfirm: (payload: { reason: string; comment?: string }) => void;
}

export function CancelOrderDialog({
  open,
  orderNumber,
  isPaid,
  isSubmitting,
  serverError,
  onClose,
  onConfirm,
}: CancelOrderDialogProps) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);

  const missingReason = touched && !reason;

  const submit = () => {
    setTouched(true);
    if (!reason) return;
    onConfirm({ reason, comment: comment.trim() || undefined });
  };

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => {} : onClose}
      title="Cancel this order?"
      description={`Order ${orderNumber} will be cancelled and cannot be reactivated.`}
      className="max-w-lg"
    >
      <div className="mt-4 space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-theme-text-muted">
            Reason for cancellation <span className="text-red-600">*</span>
          </legend>
          {CANCELLATION_REASONS.map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                reason === r
                  ? "border-secondary-600 bg-secondary-50"
                  : "border-theme-border hover:bg-theme-surface-alt"
              }`}
            >
              <input
                type="radio"
                name="cancel-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-secondary-600"
              />
              {r}
            </label>
          ))}
          {missingReason && (
            <p className="text-xs font-medium text-red-600">Please select a cancellation reason.</p>
          )}
        </fieldset>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-theme-text-muted">
            Additional comments (optional)
          </label>
          <Textarea
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more…"
          />
        </div>

        {isPaid && (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Your payment has already been received. A refund will be initiated for this order and its
            status will be shown on the order page.
          </p>
        )}

        {serverError && <p className="text-xs font-medium text-red-600">{serverError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Keep Order
          </Button>
          <Button
            onClick={submit}
            disabled={isSubmitting}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Confirm Cancellation
          </Button>
        </div>
      </div>
    </Modal>
  );
}
