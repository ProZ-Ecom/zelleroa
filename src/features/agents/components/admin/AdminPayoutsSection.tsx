"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/api-client";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/Toast";
import type { PayoutRow } from "../../types";
import { errorMessage, useAdminList } from "../../hooks/use-admin-agents";
import { ButtonPager, PAYOUT_STATUS_OPTIONS, Panel, SimpleTable, StatusBadge, TableSkeleton, dateOnly, fieldCls, money } from "../shared";
import { AdminFilterBar, type FilterField } from "./AdminFilterBar";
import { AuditModal } from "./AuditModal";

type Dialog =
  | { kind: "reject"; payout: PayoutRow }
  | { kind: "paid"; payout: PayoutRow }
  | { kind: "details"; payout: PayoutRow }
  | null;

interface Destination {
  method: string;
  upiId: string | null;
  accountHolderName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
}

const btn =
  "inline-flex min-h-[32px] items-center rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:opacity-50";

export function AdminPayoutsSection({ fixedAgent }: { fixedAgent?: string }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const params = { ...filters, ...(fixedAgent ? { agent: fixedAgent } : {}), page, limit: 20 };
  const { data, isLoading, error } = useAdminList<PayoutRow>("payouts", "/api/admin/agent-payouts", params);

  const refresh = () => qc.invalidateQueries({ queryKey: ["agents-admin"] });

  const approve = async (p: PayoutRow) => {
    setBusyId(p.id);
    try {
      await apiClient.post(`/api/admin/agent-payouts/${p.id}/approve`);
      toast.success("Payout approved", "Now transfer the money and mark it as paid.");
      await refresh();
    } catch (err) {
      toast.error("Could not approve", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const fields: FilterField[] = [
    ...(fixedAgent ? [] : [{ name: "agent", label: "Agent", type: "agent" as const }]),
    { name: "status", label: "Payout status", type: "select", options: PAYOUT_STATUS_OPTIONS },
    { name: "dateFrom", label: "Requested from", type: "date" },
    { name: "dateTo", label: "Requested to", type: "date" },
  ];

  return (
    <Panel title="Payout requests">
      <AdminFilterBar
        fields={fields}
        values={filters}
        onApply={(v) => {
          setFilters(v);
          setPage(1);
        }}
      />
      {error ? (
        <p className="px-5 py-10 text-center text-sm text-red-600">{errorMessage(error)}</p>
      ) : isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          <SimpleTable
            rows={data?.data ?? []}
            rowKey={(r) => r.id}
            empty="No payout requests match these filters."
            columns={[
              { header: "Payout", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
              ...(fixedAgent ? [] : [{ header: "Agent", cell: (r: PayoutRow) => `${r.agentName}${r.agentCode ? ` (${r.agentCode})` : ""}` }]),
              { header: "Amount", cell: (r) => <strong>{money(r.amount)}</strong> },
              { header: "Commissions", cell: (r) => r.commissionCount },
              { header: "Method", cell: (r) => (r.method === "upi" ? "UPI" : "Bank transfer") },
              { header: "Destination", cell: (r) => r.destination || "—" },
              { header: "Requested", cell: (r) => dateOnly(r.requestedAt) },
              { header: "Reviewed", cell: (r) => dateOnly(r.reviewedAt) },
              { header: "Paid", cell: (r) => dateOnly(r.paidAt) },
              { header: "Reference", cell: (r) => r.transactionReference ?? "—" },
              {
                header: "Status",
                cell: (r) => (
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={r.status} />
                    {r.rejectionReason && <span className="max-w-[12rem] text-[11px] text-red-600">{r.rejectionReason}</span>}
                  </div>
                ),
              },
              {
                header: "Actions",
                cell: (r) => (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.status === "requested" && (
                      <button type="button" disabled={busyId === r.id} onClick={() => approve(r)} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
                        {busyId === r.id ? "…" : "Approve"}
                      </button>
                    )}
                    {r.status === "approved" && (
                      <button type="button" onClick={() => setDialog({ kind: "paid", payout: r })} className={`${btn} bg-neutral-900 text-white hover:bg-neutral-800`}>
                        Mark paid
                      </button>
                    )}
                    {(r.status === "requested" || r.status === "approved") && (
                      <button type="button" onClick={() => setDialog({ kind: "reject", payout: r })} className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`}>
                        Reject
                      </button>
                    )}
                    {(r.status === "requested" || r.status === "approved") && (
                      <button type="button" onClick={() => setDialog({ kind: "details", payout: r })} className={`${btn} border border-neutral-200 hover:bg-neutral-50`}>
                        Pay-to details
                      </button>
                    )}
                    <button type="button" onClick={() => setAuditId(r.id)} className={`${btn} text-neutral-700 underline-offset-4 hover:underline`}>
                      History
                    </button>
                  </div>
                ),
              },
            ]}
          />
          <ButtonPager page={page} totalPages={data?.meta.totalPages ?? 1} total={data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}

      <RejectDialog dialog={dialog} onClose={() => setDialog(null)} onDone={refresh} />
      <PaidDialog dialog={dialog} onClose={() => setDialog(null)} onDone={refresh} />
      <DetailsDialog dialog={dialog} onClose={() => setDialog(null)} />
      <AuditModal type="payout" id={auditId} title="Payout history" onClose={() => setAuditId(null)} />
    </Panel>
  );
}

function RejectDialog({ dialog, onClose, onDone }: { dialog: Dialog; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (dialog?.kind !== "reject") return null;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post(`/api/admin/agent-payouts/${dialog.payout.id}/reject`, { reason });
      toast.success("Payout rejected");
      setReason("");
      await onDone();
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Reject ${dialog.payout.code}`} description="The commissions return to the agent's available balance so they can request again.">
      <div className="flex flex-col gap-3">
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Reason (shown to the agent)
          <textarea className={`${fieldCls} h-24 py-2`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-neutral-200 px-4 text-sm font-medium hover:bg-neutral-50">
            Cancel
          </button>
          <button type="button" disabled={busy || reason.trim().length < 3} onClick={submit} className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Reject payout
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PaidDialog({ dialog, onClose, onDone }: { dialog: Dialog; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (dialog?.kind !== "paid") return null;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post(`/api/admin/agent-payouts/${dialog.payout.id}/mark-paid`, {
        transactionReference: reference,
        note: note || undefined,
      });
      toast.success("Marked as paid");
      setReference("");
      setNote("");
      await onDone();
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Mark ${dialog.payout.code} as paid`} description={`${money(dialog.payout.amount)} to ${dialog.payout.agentName}`}>
      <div className="flex flex-col gap-3">
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Transaction / reference ID
          <input className={fieldCls} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Note (optional)
          <input className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-neutral-200 px-4 text-sm font-medium hover:bg-neutral-50">
            Cancel
          </button>
          <button type="button" disabled={busy || reference.trim().length < 3} onClick={submit} className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm payment
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Full destination is fetched only on demand and each reveal is audited server-side. */
function DetailsDialog({ dialog, onClose }: { dialog: Dialog; onClose: () => void }) {
  const [details, setDetails] = useState<Destination | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (dialog?.kind !== "details") return null;

  const reveal = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiClient.get<Destination>(`/api/admin/agent-payouts/${dialog.payout.id}/destination`);
      setDetails(res.data);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setDetails(null);
    setErr(null);
    onClose();
  };

  const rows: [string, string | null][] = details
    ? details.method === "upi"
      ? [["UPI ID", details.upiId]]
      : [
          ["Account holder", details.accountHolderName],
          ["Bank", details.bankName],
          ["Account number", details.accountNumber],
          ["IFSC", details.ifsc],
        ]
    : [];

  return (
    <Modal open onClose={close} title={`Pay-to details · ${dialog.payout.code}`} description="Sensitive. Viewing is recorded in the audit trail.">
      <div className="flex flex-col gap-3">
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        {details ? (
          <dl className="grid grid-cols-1 gap-3 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-neutral-500">{k}</dt>
                <dd className="select-all font-mono font-medium">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <button type="button" onClick={reveal} disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Reveal full details
          </button>
        )}
      </div>
    </Modal>
  );
}
