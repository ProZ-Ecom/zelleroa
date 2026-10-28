"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronLeft, Loader2, Minus, Plus, Undo2, Repeat2, Building2, Smartphone, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";
import { ApiClientError } from "@/lib/api/api-client";
import { useCustomerProfile } from "@/features/customers/hooks/use-customer-profile";
import { useReturnEligibility, useSubmitReplacement, useSubmitReturn } from "../hooks/use-returns";
import { REPLACEMENT_REASONS, RETURN_REASONS } from "../lib/policy";
import { VideoUploader } from "./VideoUploader";
import type { EligibilityItem } from "../api/returns.api";

type Mode = "return" | "replacement";
type Step = "items" | "reason" | "video" | "refund" | "details" | "review" | "done";

const STEP_TITLES: Record<Step, string> = {
  items: "Select items",
  reason: "Select reason",
  video: "Upload unboxing video",
  refund: "Customer bank details",
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

  // COD / Return Refund Details
  const [refundMethod, setRefundMethod] = useState<"bank_transfer" | "upi">("bank_transfer");
  const [upiId, setUpiId] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: customerProfile } = useCustomerProfile({ enabled: open });
  const { data: eligibility, isLoading, error, refetch } = useReturnEligibility(orderUuid, open);
  const submitReturn = useSubmitReturn(orderUuid);
  const submitReplacement = useSubmitReplacement(orderUuid);
  const isSubmitting = submitReturn.isPending || submitReplacement.isPending;

  useEffect(() => {
    if (customerProfile) {
      if (!accountHolderName && (customerProfile.bankAccountHolder || customerProfile.name)) {
        setAccountHolderName(customerProfile.bankAccountHolder || customerProfile.name || "");
      }
      if (!bankName && customerProfile.bankName) {
        setBankName(customerProfile.bankName);
      }
      if (!ifscCode && customerProfile.bankIfsc) {
        setIfscCode(customerProfile.bankIfsc);
      }
    }
  }, [customerProfile, open]);

  // For product returns, customer bank details view is displayed right after video upload
  const isReturn = mode === "return";

  const stepOrder = useMemo<Step[]>(() => {
    if (isReturn) {
      return ["items", "reason", "video", "refund", "details", "review"];
    }
    return ["items", "reason", "video", "details", "review"];
  }, [isReturn]);

  const reasons = mode === "return" ? RETURN_REASONS : REPLACEMENT_REASONS;
  const items = useMemo(() => eligibility?.items ?? [], [eligibility]);
  const chosen = items.filter((i) => selected[i.orderItemId]);

  const refundTotal = useMemo(() => {
    return chosen.reduce((acc, item) => {
      const q = selected[item.orderItemId]?.quantity ?? 1;
      return acc + item.unitPrice * q;
    }, 0);
  }, [chosen, selected]);

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
    if (s === "refund" && isReturn) {
      if (refundMethod === "upi") {
        if (!upiId.trim()) return "Please enter your UPI ID.";
        if (!/^[\w.-]+@[\w.-]+$/.test(upiId.trim())) {
          return "Please enter a valid UPI ID (e.g. name@okhdfcbank or 9876543210@paytm).";
        }
      } else {
        if (!accountHolderName.trim() || accountHolderName.trim().length < 2) {
          return "Please enter the Account Holder Name (minimum 2 characters).";
        }
        if (!accountNumber.trim() || !/^\d{9,18}$/.test(accountNumber.trim())) {
          return "Bank Account Number must be between 9 and 18 digits.";
        }
        if (!confirmAccountNumber.trim()) {
          return "Please confirm your Bank Account Number.";
        }
        if (accountNumber.trim() !== confirmAccountNumber.trim()) {
          return "Bank Account Number and Confirm Account Number do not match.";
        }
        if (!ifscCode.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode.trim())) {
          return "Please enter a valid 11-digit IFSC Code (e.g. SBIN0001234).";
        }
        if (!bankName.trim() || bankName.trim().length < 2) {
          return "Please enter the Bank Name (e.g. State Bank of India, HDFC).";
        }
      }
    }
    return null;
  };

  const next = () => {
    const problem = validateStep(step);
    if (problem) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    const curIdx = stepOrder.indexOf(step);
    if (curIdx < stepOrder.length - 1) {
      setStep(stepOrder[curIdx + 1]);
    }
  };

  const back = () => {
    setShowErrors(false);
    const curIdx = stepOrder.indexOf(step);
    if (curIdx > 0) {
      setStep(stepOrder[curIdx - 1]);
    }
  };

  const submit = async () => {
    setServerError(null);
    const stepsToCheck = isReturn
      ? (["items", "reason", "video", "refund"] as Step[])
      : (["items", "reason", "video"] as Step[]);
    for (const s of stepsToCheck) {
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
          codRefundDetails: isReturn
            ? {
                method: refundMethod,
                upiId: refundMethod === "upi" ? upiId.trim() : undefined,
                accountHolderName: refundMethod === "bank_transfer" ? accountHolderName.trim() : undefined,
                bankName: refundMethod === "bank_transfer" ? bankName.trim() || undefined : undefined,
                accountNumber: refundMethod === "bank_transfer" ? accountNumber.trim() : undefined,
                confirmAccountNumber: refundMethod === "bank_transfer" ? confirmAccountNumber.trim() : undefined,
                ifscCode: refundMethod === "bank_transfer" ? ifscCode.trim().toUpperCase() : undefined,
              }
            : undefined,
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
  const stepIndex = stepOrder.indexOf(step);
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
                Step {stepIndex + 1} of {stepOrder.length} · {STEP_TITLES[step]}
              </span>
              <span>{eligibility.window.message}</span>
            </div>
            <div className="h-1 rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-secondary-600 transition-all"
                style={{ width: `${((stepIndex + 1) / stepOrder.length) * 100}%` }}
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

          {step === "refund" && isReturn && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-amber-100 p-2 text-amber-800 shrink-0 mt-0.5">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold uppercase tracking-wider text-amber-900">
                      Customer Bank Details for Refund
                    </p>
                    <p className="mt-1 text-amber-800 leading-relaxed">
                      Please enter your bank account details below. Your refund of{" "}
                      <strong className="font-semibold text-neutral-900">{formatPrice(refundTotal)}</strong> will
                      be transferred directly into this account once your return is received and verified.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-theme-text-muted">
                  Choose Refund Method
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRefundMethod("bank_transfer")}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                      refundMethod === "bank_transfer"
                        ? "border-secondary-600 bg-secondary-50/60 shadow-sm ring-1 ring-secondary-600"
                        : "border-theme-border bg-white hover:bg-theme-surface-alt"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between mb-1.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        Recommended
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-theme-text-primary">Bank Account</p>
                    <p className="text-xs text-theme-text-muted mt-0.5">Direct transfer to your Savings / Current A/C</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRefundMethod("upi")}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                      refundMethod === "upi"
                        ? "border-secondary-600 bg-secondary-50/60 shadow-sm ring-1 ring-secondary-600"
                        : "border-theme-border bg-white hover:bg-theme-surface-alt"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between mb-1.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
                        <Smartphone className="h-4 w-4" />
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                        Instant UPI
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-theme-text-primary">UPI Transfer</p>
                    <p className="text-xs text-theme-text-muted mt-0.5">Google Pay, PhonePe, Paytm, BHIM</p>
                  </button>
                </div>
              </div>

              {refundMethod === "bank_transfer" ? (
                <div className="space-y-3.5 rounded-xl border border-theme-border bg-theme-surface-alt p-4">
                  {customerProfile?.bankAccountLast4 && (
                    <div className="flex items-center gap-2 text-xs bg-white border border-emerald-200 text-emerald-800 rounded-lg p-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Previously saved account ending in <strong>••••{customerProfile.bankAccountLast4}</strong> detected. You can re-enter your account number below to confirm or provide a different account.
                      </span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-theme-text-primary">
                      Account Holder Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      placeholder="As shown in your bank passbook / statement"
                      className="bg-white text-sm"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-theme-text-primary">
                        Bank Account Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="password"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                        maxLength={18}
                        placeholder="Enter 9 to 18 digits"
                        className="font-mono tracking-wider bg-white text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-theme-text-primary">
                        Confirm Account Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={confirmAccountNumber}
                        onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ""))}
                        maxLength={18}
                        placeholder="Re-enter bank account number"
                        className="font-mono tracking-wider bg-white text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-theme-text-primary">
                        IFSC Code <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                        maxLength={11}
                        placeholder="e.g. SBIN0001234 or HDFC0000456"
                        className="font-mono uppercase tracking-wider bg-white text-sm"
                      />
                      <p className="text-[11px] text-theme-text-muted">
                        11-character code printed on chequebook or passbook
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-theme-text-primary">
                        Bank Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. State Bank of India, HDFC Bank"
                        className="bg-white text-sm"
                      />
                      <p className="text-[11px] text-theme-text-muted">
                        Official bank name
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      Your account details are protected with bank-grade encryption and only used for processing your refund.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 rounded-xl border border-theme-border bg-theme-surface-alt p-3.5">
                  <label className="text-xs font-semibold text-theme-text-primary">
                    UPI ID / VPA <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. mobile@paytm or name@okaxis"
                    className="font-mono text-sm bg-white"
                  />
                  <p className="text-[11px] text-theme-text-muted">
                    We will send the refund directly to this UPI address (GPay, PhonePe, Paytm, BHIM, etc.)
                  </p>
                </div>
              )}
            </div>
          )}

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
              {isReturn && (
                <SummaryBlock title="Refund Destination (Bank Details)">
                  <li>
                    <strong>Method:</strong> {refundMethod === "upi" ? "Instant UPI Transfer" : "Bank Account (NEFT/IMPS)"}
                  </li>
                  {refundMethod === "upi" ? (
                    <li>
                      <strong>UPI ID:</strong> <span className="font-mono">{upiId}</span>
                    </li>
                  ) : (
                    <>
                      <li><strong>Account Holder Name:</strong> {accountHolderName}</li>
                      <li><strong>Bank Name:</strong> {bankName}</li>
                      <li>
                        <strong>Bank Account Number:</strong> <span className="font-mono">••••{accountNumber.slice(-4)}</span>
                      </li>
                      <li>
                        <strong>IFSC Code:</strong> <span className="font-mono uppercase">{ifscCode}</span>
                      </li>
                    </>
                  )}
                  <li>
                    <strong>Estimated Refund:</strong> {formatPrice(refundTotal)}
                  </li>
                </SummaryBlock>
              )}
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
