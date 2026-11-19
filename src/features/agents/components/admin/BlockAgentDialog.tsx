"use client";

import * as React from "react";
import { Ban, PauseCircle, Users, ArrowRightLeft, ShieldAlert, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAgentOptions } from "../../hooks/use-admin-agents";
import { money } from "../shared";

export const BLOCK_REASON_MAX_LENGTH = 500;

export type CustomerAction = "keep" | "release" | "transfer";

export interface BlockAgentDialogAgent {
  id: string;
  name: string;
  agentCode?: string | null;
  summary?: {
    totalReferredCustomers: number;
    activeCustomers?: number;
    pendingCommission?: number;
    approvedCommission?: number;
    openPayouts?: number;
  };
}

export interface BlockAgentPayload {
  reason: string;
  customerAction: CustomerAction;
  transferToAgentId?: string;
}

interface BlockAgentDialogProps {
  open: boolean;
  agent: BlockAgentDialogAgent | null | undefined;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (payload: BlockAgentPayload) => Promise<void>;
}

const QUICK_REASONS = [
  "Fraudulent orders / Policy violation",
  "Partner requested resignation / offboarding",
  "Inactive / Unresponsive partner",
  "KYC / Account verification pending",
];

export function BlockAgentDialog({
  open,
  agent,
  isLoading = false,
  onClose,
  onConfirm,
}: BlockAgentDialogProps) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [customerAction, setCustomerAction] = React.useState<CustomerAction>("keep");
  const [transferToAgentId, setTransferToAgentId] = React.useState("");
  const [transferError, setTransferError] = React.useState<string | null>(null);

  const { data: options = [] } = useAgentOptions();

  const customerCount = agent?.summary?.totalReferredCustomers ?? 0;
  const activeCustomerCount = agent?.summary?.activeCustomers ?? 0;
  const pendingMoney = (agent?.summary?.pendingCommission ?? 0) + (agent?.summary?.approvedCommission ?? 0);
  const openPayouts = agent?.summary?.openPayouts ?? 0;

  // Active agents excluding the current agent
  const destinationChoices = React.useMemo(() => {
    if (!agent) return [];
    return options.filter((o) => o.isActive && o.id !== agent.id);
  }, [options, agent]);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
      setCustomerAction("keep");
      setTransferToAgentId("");
      setTransferError(null);
    }
  }, [open]);

  const trimmedReason = reason.trim();
  const reasonError = touched && !trimmedReason ? "Please enter a reason for blocking." : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!trimmedReason) return;

    if (customerCount > 0 && customerAction === "transfer" && !transferToAgentId) {
      setTransferError("Please select a destination Sales Partner to transfer customers to.");
      return;
    }

    setTransferError(null);

    await onConfirm({
      reason: trimmedReason,
      customerAction,
      transferToAgentId: customerAction === "transfer" ? transferToAgentId : undefined,
    });
  };

  if (!agent) return null;

  return (
    <Modal
      open={open}
      onClose={isLoading ? () => {} : onClose}
      className="max-w-xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start gap-3.5 border-b border-neutral-100 pb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100/80 text-red-700 ring-4 ring-red-50">
            <Ban className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-neutral-900">
                Block Sales Partner
              </h3>
              {agent.agentCode && (
                <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-neutral-600">
                  {agent.agentCode}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">
              Suspend <span className="font-semibold text-neutral-800">{agent.name}</span> from the Sales Partner portal.
            </p>
          </div>
        </div>

        {/* Impact stats snapshot */}
        <div className="grid grid-cols-3 gap-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-neutral-500">Assigned Customers</span>
            <span className="text-base font-bold text-neutral-900">
              {customerCount}{" "}
              {customerCount > 0 && activeCustomerCount > 0 && (
                <span className="text-[11px] font-normal text-emerald-700">({activeCustomerCount} active)</span>
              )}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-neutral-500">Unsettled Commissions</span>
            <span className="text-base font-bold text-neutral-900">
              {money(pendingMoney)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-neutral-500">Open Payout Requests</span>
            <span className={`text-base font-bold ${openPayouts > 0 ? "text-amber-700" : "text-neutral-900"}`}>
              {openPayouts}
            </span>
          </div>
        </div>

        {/* Mandatory Reason */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="block-reason" className="text-xs font-semibold text-neutral-800">
              Reason for Blocking <span className="text-red-600">*</span>
            </label>
            <span className="text-[11px] text-neutral-400">
              {reason.length}/{BLOCK_REASON_MAX_LENGTH}
            </span>
          </div>
          <textarea
            id="block-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (touched) setTouched(false);
            }}
            onBlur={() => setTouched(true)}
            maxLength={BLOCK_REASON_MAX_LENGTH}
            rows={3}
            disabled={isLoading}
            autoFocus
            placeholder="Explain why this Sales Partner is being blocked (policy violation, resignation, fraud, etc.)..."
            className={`w-full resize-none rounded-xl border bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-all focus:ring-2 ${
              reasonError
                ? "border-red-400 focus:ring-red-200"
                : "border-neutral-200 focus:border-neutral-900 focus:ring-neutral-200"
            }`}
          />
          {reasonError && (
            <p className="mt-1 text-xs text-red-600">{reasonError}</p>
          )}

          {/* Quick preset chips */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="self-center text-[11px] font-medium text-neutral-400">Presets:</span>
            {QUICK_REASONS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setReason(preset);
                  setTouched(false);
                }}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Customer Handling Strategy (shown if agent has assigned customers) */}
        {customerCount > 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-3.5 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Customer Handling Flow
                </h4>
                <p className="text-[11px] text-neutral-500">
                  Select what happens to the {customerCount} customer(s) linked to this partner:
                </p>
              </div>
              <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                {customerCount} Customers
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Option 1: Keep Attached (Freeze) */}
              <label
                className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                  customerAction === "keep"
                    ? "border-neutral-900 bg-white shadow-xs"
                    : "border-neutral-200 bg-white/70 hover:border-neutral-300 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="customerAction"
                  value="keep"
                  checked={customerAction === "keep"}
                  onChange={() => setCustomerAction("keep")}
                  className="mt-1 h-4 w-4 text-neutral-900 accent-neutral-900 focus:ring-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <PauseCircle className="h-4 w-4 text-neutral-700" />
                    <span className="text-xs font-bold text-neutral-900">
                      Keep Attached & Freeze Commissions
                    </span>
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Recommended
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
                    Customers remain assigned, but all future commission accrual is completely frozen (0%). If unblocked later, customer links remain intact with zero data loss.
                  </p>
                </div>
              </label>

              {/* Option 2: Release to Open Pool */}
              <label
                className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                  customerAction === "release"
                    ? "border-neutral-900 bg-white shadow-xs"
                    : "border-neutral-200 bg-white/70 hover:border-neutral-300 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="customerAction"
                  value="release"
                  checked={customerAction === "release"}
                  onChange={() => setCustomerAction("release")}
                  className="mt-1 h-4 w-4 text-neutral-900 accent-neutral-900 focus:ring-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-neutral-700" />
                    <span className="text-xs font-bold text-neutral-900">
                      Release to Open Pool (Remove Partner)
                    </span>
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                      Zellora Direct
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
                    Unlinks all {customerCount} customer(s). They become direct store shoppers with no partner assigned. If they use another active partner&apos;s referral link in the future, they can link to that new partner.
                  </p>
                </div>
              </label>

              {/* Option 3: Transfer to Another Active Partner */}
              <label
                className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                  customerAction === "transfer"
                    ? "border-neutral-900 bg-white shadow-xs"
                    : "border-neutral-200 bg-white/70 hover:border-neutral-300 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="customerAction"
                  value="transfer"
                  checked={customerAction === "transfer"}
                  onChange={() => setCustomerAction("transfer")}
                  className="mt-1 h-4 w-4 text-neutral-900 accent-neutral-900 focus:ring-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-neutral-700" />
                    <span className="text-xs font-bold text-neutral-900">
                      Transfer Customers to Another Partner
                    </span>
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      Handover
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
                    Immediately handover all {customerCount} customer(s) to another active Sales Partner for assisted ordering and future commissions.
                  </p>

                  {/* Destination Partner Selector */}
                  {customerAction === "transfer" && (
                    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5" onClick={(e) => e.stopPropagation()}>
                      <label className="block text-[11px] font-semibold text-neutral-700">
                        Destination Sales Partner <span className="text-red-600">*</span>
                      </label>
                      <div className="mt-1">
                        <Select
                          portal={true}
                          searchable={destinationChoices.length > 5}
                          placeholder="Select active Sales Partner..."
                          options={destinationChoices.map((c) => ({
                            value: c.id,
                            label: `${c.name}${c.agentCode ? ` (${c.agentCode})` : ""}`,
                          }))}
                          value={transferToAgentId}
                          onValueChange={(val) => {
                            setTransferToAgentId(val);
                            setTransferError(null);
                          }}
                        />
                      </div>
                      {transferError && (
                        <p className="mt-1.5 text-xs text-red-600">{transferError}</p>
                      )}
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 text-xs text-neutral-500">
            ℹ️ This partner currently has no assigned customers. Blocking will deactivate login and pause portal features.
          </div>
        )}

        {/* Financial protection advisory */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="leading-snug">
            <span className="font-semibold">Security Note:</span> The partner will be immediately logged out. Any pending or requested payouts will remain on hold until administrative review.
          </p>
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-neutral-100 pt-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl font-medium text-neutral-700"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            className="rounded-xl font-semibold shadow-xs"
            isLoading={isLoading}
            disabled={!trimmedReason || (customerCount > 0 && customerAction === "transfer" && !transferToAgentId)}
          >
            Confirm & Block Partner
          </Button>
        </div>
      </form>
    </Modal>
  );
}
