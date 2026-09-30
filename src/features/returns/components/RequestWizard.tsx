"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronLeft, Loader2, Minus, Plus, Undo2, Repeat2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";
import { ApiClientError } from "@/lib/api/api-client";
import { useReturnEligibility, useSubmitReplacement, useSubmitReturn } from "../hooks/use-returns";
import { REPLACEMENT_REASONS, RETURN_REASONS } from "../lib/policy";
import { VideoUploader } from "./VideoUploader";
import type { EligibilityItem } from "../api/returns.api";

type Mode = "return" | "replacement";
type Step = "items" | "reason" | "video" | "details" | "review" | "done";

const STEP_ORDER: Step[] = ["items", "reason", "video", "details", "review"];
const STEP_TITLES: Record<Step, string> = {
  items: "Select items",
  reason: "Select reason",
  video: "Upload unboxing video",
  details: "Additional details",
  review: "Review & submit",
  done: "Request submitted",
};

interface Selection {
  quantity: number;
  sizeId?: string;
}

interface RequestWizardProps {
  open: boolean;
  orderUuid: string;
  initialMode: Mode;
  onClose: () => void;
}

export function RequestWizard({ open, orderUuid, initialMode, onClose }: RequestWizardProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("items");
  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: eligibility, isLoading, error, refetch } = useReturnEligibility(orderUuid, open);
  const submitReturn = useSubmitReturn(orderUuid);
  const submitReplacement = useSubmitReplacement(orderUuid);
  const isSubmitting = submitReturn.isPending || submitReplacement.isPending;

  const reasons = mode === "return" ? RETURN_REASONS : REPLACEMENT_REASONS;
  const items = useMemo(() => eligibility?.items ?? [], [eligibility]);
  const chosen = items.filter((i) => selected[i.orderItemId]);

  const changeMode = (m: Mode) => {
    setMode(m);
    setSelected({});
    setReason("");
  };

  const toggleItem = (item: EligibilityItem) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.orderItemId]) {
        delete next[item.orderItemId];
      } else {
        const current = item.replacementSizes.find((s) => s.isCurrent) ?? item.replacementSizes[0];
        next[item.orderItemId] = { quantity: item.quantity, sizeId: current?.id };
      }
      return next;
    });
  };

  const setQty = (item: EligibilityItem, delta: number) =>
    setSelected((prev) => {
      const cur = prev[item.orderItemId];
      if (!cur) return prev;
      const quantity = Math.min(item.quantity, Math.max(1, cur.quantity + delta));
      return { ...prev, [item.orderItemId]: { ...cur, quantity } };
    });

  const descriptionMissing = reason === "Other" && description.trim().length < 5;

  const validateStep = (s: Step): string | null => {
    if (s === "items") return chosen.length === 0 ? "Select at least one item." : null;
    if (s === "reason") {
      if (!reason) return "Please select a reason.";
      if (descriptionMissing) return "Please describe the issue when selecting 'Other'.";
    }
    if (s === "video" && !videoUrl) return "Unboxing video is mandatory.";
    return null;
  };

  const next = () => {
    const problem = validateStep(step);
    if (problem) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep(STEP_ORDER[STEP_ORDER.indexOf(step) + 1]);
  };

  const back = () => {
    setShowErrors(false);
    setStep(STEP_ORDER[Math.max(0, STEP_ORDER.indexOf(step) - 1)]);
  };

  const submit = async () => {
    setServerError(null);
    for (const s of ["items", "reason", "video"] as Step[]) {
      if (validateStep(s)) {
        setStep(s);
        setShowErrors(true);
        return;
      }
    }
    try {
      const base = {
        reason,
        description: description.trim() || undefined,
        unboxingVideoUrl: videoUrl!,
      };
      if (mode === "return") {
        await submitReturn.mutateAsync({
          ...base,
          items: chosen.map((i) => ({ orderItemId: i.orderItemId, quantity: selected[i.orderItemId].quantity })),
        });
      } else {
        await submitReplacement.mutateAsync({
          ...base,
          items: chosen.map((i) => ({
            orderItemId: i.orderItemId,
            quantity: selected[i.orderItemId].quantity,
            requestedVariantUnitPriceId: selected[i.orderItemId].sizeId,
          })),
        });
      }
      toast.success(`${mode === "return" ? "Return" : "Replacement"} request submitted successfully.`);
      setStep("done");
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? [err.message, ...(err.errors ?? [])].join(" ")
          : "Something went wrong. Please try again.";
      setServerError(msg);
      toast.error("Could not submit request", msg);
      void refetch();
    }
  };

  const eligibleForMode = mode === "return" ? eligibility?.canReturn : eligibility?.canReplace;
  const stepIndex = STEP_ORDER.indexOf(step);
  const stepError = showErrors ? validateStep(step) : null;
  const label = mode === "return" ? "Return" : "Replacement";

  return (
    <Modal open={open} onClose={isSubmitting ? () => {} : onClose} title={`Request ${label}`} className="max-w-2xl">
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-16 rounded-xl skeleton-shimmer" />
          <div className="h-16 rounded-xl skeleton-shimmer" />
        </div>
      ) : error || !eligibility ? (
        <div className="space-y-3 text-center py-4">
          <p className="text-sm text-red-600">{(error as Error)?.message || "Could not load eligibility."}</p>
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : step === "done" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          <h3 className="text-lg font-bold text-theme-text-primary">
            {label} request submitted successfully.
          </h3>
          <p className="text-sm text-theme-text-subtle">Our team will review your request.</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : !eligibility.window.eligible ? (
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm font-semibold text-red-700">{eligibility.window.message}</p>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["return", "replacement"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => changeMode(m)}
                disabled={step !== "items"}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                  mode === m
                    ? "border-secondary-600 bg-secondary-50 text-secondary-800"
                    : "border-theme-border text-theme-text-muted hover:bg-theme-surface-alt"
                }`}
              >
                {m === "return" ? <Undo2 className="h-4 w-4" /> : <Repeat2 className="h-4 w-4" />}
                {m === "return" ? "Return" : "Replacement"}
              </button>
            ))}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-theme-text-muted">
              <span>
                Step {stepIndex + 1} of {STEP_ORDER.length} · {STEP_TITLES[step]}
              </span>
              <span>{eligibility.window.message}</span>
            </div>
            <div className="h-1 rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-secondary-600 transition-all"
                style={{ width: `${((stepIndex + 1) / STEP_ORDER.length) * 100}%` }}
              />
            </div>
          </div>

          {!eligibleForMode && step === "items" && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {mode === "replacement"
                ? "No items in this order have an in-stock replacement available, or they already have an open request."
                : "All items in this order already have an open request."}
            </p>
          )}

          {step === "items" && (
            <ul className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {items.map((item) => {
                const sel = selected[item.orderItemId];
                const selectable = item.canRequest && (mode === "return" || item.replacementSizes.length > 0);
                return (
                  <li
                    key={item.orderItemId}
                    className={`rounded-xl border p-3 ${
                      sel ? "border-secondary-600 bg-secondary-50/40" : "border-theme-border"
                    } ${selectable ? "" : "opacity-60"}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-secondary-600"
                        checked={Boolean(sel)}
                        disabled={!selectable}
                        onChange={() => toggleItem(item)}
                        aria-label={`Select ${item.productName}`}
                      />
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                        {item.image && (
                          <Image src={item.image} alt={item.productName} fill sizes="64px" className="object-cover" unoptimized />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold text-theme-text-primary">{item.productName}</p>
                        <p className="text-xs text-theme-text-subtle">
                          {[item.variantName, item.size && `Size: ${item.size}`, item.color && `Color: ${item.color}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="text-xs text-theme-text-subtle">
                          Qty {item.quantity} · {formatPrice(item.unitPrice)}
                        </p>
                        {!selectable && (
                          <p className="mt-1 text-xs font-medium text-amber-700">
                            {item.blockedReason ||
                              (mode === "replacement" ? "No replacement size is currently in stock." : "Not eligible.")}
                          </p>
                        )}
                      </div>
                    </div>

                    {sel && (
                      <div className="mt-3 flex flex-wrap items-center gap-4 pl-7">
                        {item.quantity > 1 && (
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            <span className="text-theme-text-muted">Quantity</span>
                            <button type="button" className="rounded border p-1 hover:bg-neutral-100" onClick={() => setQty(item, -1)} aria-label="Decrease">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center">{sel.quantity}</span>
                            <button type="button" className="rounded border p-1 hover:bg-neutral-100" onClick={() => setQty(item, 1)} aria-label="Increase">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {mode === "replacement" && item.replacementSizes.length > 0 && (
                          <div className="text-xs font-semibold">
                            <p className="mb-1 text-theme-text-muted">
                              Current size: {item.size ?? "—"} · Replacement size
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.replacementSizes.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() =>
                                    setSelected((p) => ({ ...p, [item.orderItemId]: { ...p[item.orderItemId], sizeId: s.id } }))
                                  }
                                  className={`rounded-lg border px-3 py-1 ${
                                    sel.sizeId === s.id
                                      ? "border-secondary-600 bg-secondary-600 text-white"
                                      : "border-theme-border hover:bg-neutral-100"
                                  }`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {step === "reason" && (
            <div className="space-y-3">
              <fieldset className="grid gap-2 sm:grid-cols-2">
                {reasons.map((r) => (
                  <label
                    key={r}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                      reason === r ? "border-secondary-600 bg-secondary-50" : "border-theme-border hover:bg-theme-surface-alt"
                    }`}
                  >
                    <input type="radio" name="request-reason" checked={reason === r} onChange={() => setReason(r)} className="accent-secondary-600" />
                    {r}
                  </label>
                ))}
              </fieldset>
              {reason === "Other" && (
                <Textarea
                  value={description}
                  maxLength={1000}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue (required)"
                  error={showErrors && descriptionMissing ? "Please describe the issue." : undefined}
                />
              )}
            </div>
          )}

          {step === "video" && <VideoUploader value={videoUrl} onChange={setVideoUrl} />}

          {step === "details" && (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-theme-text-muted">
                Additional comments (optional)
              </label>
              <Textarea
                value={description}
                maxLength={1000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Anything else our team should know?"
              />
            </div>
          )}

          {step === "review" && (
            <div className="space-y-3 text-sm">
              <SummaryBlock title={`${label} items`}>
                {chosen.map((i) => {
                  const sel = selected[i.orderItemId];
                  const size = i.replacementSizes.find((s) => s.id === sel.sizeId);
                  return (
                    <li key={i.orderItemId}>
                      {i.productName} × {sel.quantity}
                      {mode === "replacement" && size ? ` → size ${size.label}` : ""}
                    </li>
                  );
                })}
              </SummaryBlock>
              <SummaryBlock title="Reason"><li>{reason}</li></SummaryBlock>
              <SummaryBlock title="Unboxing video">
                <li className="list-none">
                  {videoUrl && <video src={videoUrl} controls preload="metadata" className="max-h-44 rounded-lg bg-black" />}
                </li>
              </SummaryBlock>
              <SummaryBlock title="Additional comments"><li>{description.trim() || "—"}</li></SummaryBlock>
              {serverError && <p className="text-xs font-medium text-red-600">{serverError}</p>}
            </div>
          )}

          {stepError && <p className="text-xs font-medium text-red-600">{stepError}</p>}

          <div className="flex items-center justify-between pt-1">
            <Button variant="outline" onClick={stepIndex === 0 ? onClose : back} disabled={isSubmitting}>
              {stepIndex === 0 ? "Cancel" : (<><ChevronLeft className="mr-1 h-4 w-4" />Back</>)}
            </Button>
            {step === "review" ? (
              <Button onClick={submit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Confirm &amp; Submit
              </Button>
            ) : (
              <Button onClick={next} disabled={step === "items" && !eligibleForMode}>
                Continue
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-theme-border bg-theme-surface-alt p-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-theme-text-muted">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-theme-text-primary">{children}</ul>
    </div>
  );
}
