"use client";

import * as React from "react";
import { Ban } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";

export const BLOCK_REASON_MAX_LENGTH = 500;

interface BlockReasonDialogProps {
  open: boolean;
  /** "User" or "Agent" - drives the title and copy. */
  subject: "User" | "Agent";
  /** Display name of the account being blocked. */
  name?: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function BlockReasonDialog({
  open,
  subject,
  name,
  isLoading,
  onClose,
  onConfirm,
}: BlockReasonDialogProps) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);

  const trimmed = reason.trim();
  const error = touched && !trimmed ? "Please enter a reason for blocking." : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Modal open={open} onClose={isLoading ? () => {} : onClose}>
      <form onSubmit={submit} noValidate>
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-red-50 p-3 text-red-600">
            <Ban className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-lg font-bold tracking-tight text-neutral-900">
            Block {subject}
          </h3>
          <p className="mb-5 max-w-sm text-sm leading-relaxed text-neutral-500">
            {`Are you sure you want to block ${name || `this ${subject.toLowerCase()}`}? They will be deactivated and unable to sign in.`}
          </p>
        </div>

        <label
          htmlFor="block-reason"
          className="mb-1.5 block text-sm font-semibold text-neutral-800"
        >
          Reason <span className="text-red-600">*</span>
        </label>
        <textarea
          id="block-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={BLOCK_REASON_MAX_LENGTH}
          rows={3}
          autoFocus
          disabled={isLoading}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "block-reason-error" : undefined}
          placeholder="Enter the reason for blocking this account"
          className={`w-full resize-none rounded-xl border bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 ${
            error
              ? "border-red-400 focus:ring-red-200"
              : "border-neutral-200 focus:ring-secondary-200"
          }`}
        />
        <div className="mt-1 flex items-start justify-between gap-2 text-xs">
          <span id="block-reason-error" role="alert" className="text-red-600">
            {error}
          </span>
          <span className="shrink-0 text-neutral-400">
            {reason.length}/{BLOCK_REASON_MAX_LENGTH}
          </span>
        </div>

        <div className="mt-5 flex w-full gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 cursor-pointer rounded-xl border-cream-border font-semibold text-neutral-700 hover:bg-cream-200"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            className="flex-1 cursor-pointer rounded-xl font-semibold"
            isLoading={isLoading}
            disabled={!trimmed}
          >
            Block
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export { BlockReasonDialog };
