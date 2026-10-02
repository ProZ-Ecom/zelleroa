"use client";

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ExternalLink, Loader2, XCircle } from "lucide-react";
import { apiClient } from "@/lib/api/api-client";
import { toast } from "@/components/ui/Toast";
import type { AgentProfileDto } from "../../services/agent-profile.service";
import { errorMessage, useAdminObject } from "../../hooks/use-admin-agents";
import { GENDER_LABELS } from "../../validations/agent-profile.schema";
import { ProfileCompletionCard } from "../ProfileCompletionCard";
import { Panel, StatusBadge, dateOnly } from "../shared";

function Info({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2 sm:p-5">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-neutral-500">{k}</dt>
          <dd className="break-words font-medium text-neutral-900">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function DocLink({ agentId, kind, present, label }: { agentId: string; kind: string; present: boolean; label: string }) {
  if (!present) return <span className="text-neutral-400">{label}: not uploaded</span>;
  return (
    <a href={`/api/admin/agents/${agentId}/document/${kind}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-neutral-900 underline">
      {label} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function ReviewBar({
  agentId,
  target,
  status,
  remarks,
  onDone,
}: {
  agentId: string;
  target: "kyc" | "bank";
  status: string;
  remarks: string | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<"verify" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async (action: "verify" | "reject") => {
    if (action === "reject" && !reason.trim()) {
      setError("Give a reason so the Sales Partner knows what to fix");
      return;
    }
    setBusy(action);
    setError(null);
    try {
      await apiClient.post(`/api/admin/agents/${agentId}/review`, { target, action, remarks: reason.trim() || undefined });
      toast.success(action === "verify" ? "Marked as verified" : "Marked as rejected");
      setRejecting(false);
      setReason("");
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-neutral-500">Status</span>
        <StatusBadge status={status} />
        {remarks && <span className="text-xs text-neutral-500">Remarks: {remarks}</span>}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={busy !== null || status === "verified"}
            onClick={() => run("verify")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Verify
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setRejecting((r) => !r)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" /> Reject
          </button>
        </div>
      </div>
      {rejecting && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
            placeholder="Reason (shown to the Sales Partner)"
            className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-400"
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("reject")}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy === "reject" && <Loader2 className="h-4 w-4 animate-spin" />} Confirm reject
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** Admin view of a Sales Partner's full profile. Aadhaar / PAN / account numbers arrive already masked from the API. */
export function AdminProfileSection({ agentId }: { agentId: string }) {
  const qc = useQueryClient();
  const { data: p, isLoading, error } = useAdminObject<AgentProfileDto>("profile", `/api/admin/agents/${agentId}/profile`);
  const refresh = () => qc.invalidateQueries({ queryKey: ["agents-admin", "profile"] });

  if (error) return <p className="py-10 text-center text-sm text-red-600">{errorMessage(error)}</p>;
  if (isLoading || !p) return <p className="py-10 text-center text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <ProfileCompletionCard completion={p.completion} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Personal details">
          <Info
            rows={[
              ["Full name", p.personal.name],
              ["Mobile", p.personal.phone],
              ["Alternate mobile", p.personal.altPhone],
              ["Email", p.personal.email],
              ["Date of birth", p.personal.dob ? dateOnly(p.personal.dob) : null],
              ["Gender", p.personal.gender ? GENDER_LABELS[p.personal.gender as keyof typeof GENDER_LABELS] ?? p.personal.gender : null],
              [
                "Photo",
                p.personal.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.personal.photo} alt="" className="h-16 w-16 rounded-full object-cover" />
                ) : null,
              ],
            ]}
          />
        </Panel>

        <Panel title="Address">
          <Info
            rows={[
              ["Address line 1", p.address.line1],
              ["Address line 2", p.address.line2],
              ["Area / street", p.address.area],
              ["City", p.address.city],
              ["District", p.address.district],
              ["State", p.address.state],
              ["Pincode", p.address.pincode],
              ["Country", p.address.country],
            ]}
          />
        </Panel>

        <Panel title="KYC details">
          <Info
            rows={[
              ["Aadhaar number", p.kyc.aadhaarMasked],
              ["PAN number", p.kyc.panMasked],
              ["Aadhaar card", <DocLink key="a" agentId={agentId} kind="aadhaar" present={p.kyc.hasAadhaarDoc} label="View document" />],
              ["PAN card", <DocLink key="p" agentId={agentId} kind="pan" present={p.kyc.hasPanDoc} label="View document" />],
            ]}
          />
          <ReviewBar agentId={agentId} target="kyc" status={p.kyc.status} remarks={p.kyc.remarks} onDone={refresh} />
        </Panel>

        <Panel title="Bank details">
          <Info
            rows={[
              ["Account holder", p.bank.accountHolder],
              ["Bank name", p.bank.bankName],
              ["Account number", p.bank.accountMasked],
              ["IFSC code", p.bank.ifsc],
              ["Branch", p.bank.branch],
              ["Bank proof", <DocLink key="b" agentId={agentId} kind="bank" present={p.bank.hasProof} label="View document" />],
            ]}
          />
          <ReviewBar agentId={agentId} target="bank" status={p.bank.status} remarks={p.bank.remarks} onDone={refresh} />
        </Panel>
      </div>
    </div>
  );
}
