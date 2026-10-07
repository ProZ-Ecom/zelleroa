"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { errorMessage, useAdminObject, useAgentOptions } from "../../hooks/use-admin-agents";

interface HistoryRow {
  id: string;
  action: "assigned" | "transferred";
  fromAgentName: string | null;
  fromAgentCode: string | null;
  toAgentName: string;
  toAgentCode: string | null;
  transferredBy: string;
  reason: string | null;
  at: string;
}
interface AssignmentData {
  agent: { id: string; name: string; agentCode: string | null } | null;
  assignedAt: string | null;
  history: HistoryRow[];
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const label = (name: string | null, code: string | null) => (name ? `${name}${code ? ` (${code})` : ""}` : "—");

/** Admin-only: shows a customer's Sales Partner, transfers them, and lists every past change. */
export function CustomerAgentCard({ customerId, canTransfer = true }: { customerId: string; canTransfer?: boolean }) {
  const endpoint = `/api/admin/customers/${encodeURIComponent(customerId)}/agent`;
  const qc = useQueryClient();
  const { data, isLoading, error } = useAdminObject<AssignmentData>("customer-agent", endpoint, Boolean(customerId));
  const { data: options } = useAgentOptions();
  const [toAgent, setToAgent] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const choices = (options ?? []).filter((o) => o.isActive && o.id !== data?.agent?.id);

  async function submit() {
    setConfirming(false);
    if (!toAgent) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.post(endpoint, { toAgentId: toAgent, fromAgentId: data?.agent?.id ?? null, reason: reason.trim() || undefined });
      setToAgent("");
      setReason("");
      setMsg({ ok: true, text: "Customer transferred. Past orders and commissions stay with their original Sales Partner." });
      await qc.invalidateQueries({ queryKey: ["agents-admin"] });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="sales-partner" className="scroll-mt-20 rounded-2xl border border-cream-border bg-white shadow-xs p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Sales Partner</h3>
        {isLoading ? (
          <p className="text-sm text-neutral-500 mt-1">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600 mt-1">{errorMessage(error)}</p>
        ) : (
          <p className="text-sm text-neutral-700 mt-1">
            {data?.agent ? (
              <>
                <strong>{label(data.agent.name, data.agent.agentCode)}</strong>
                {data.assignedAt ? <span className="text-neutral-500"> · since {fmt(data.assignedAt)}</span> : null}
              </>
            ) : (
              "Not assigned to any Sales Partner"
            )}
          </p>
        )}
      </div>

      {canTransfer && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
          <label className="text-xs text-neutral-600">
            {data?.agent ? "Transfer to" : "Assign to"}
            <select
              value={toAgent}
              onChange={(e) => setToAgent(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cream-border px-3 py-2 text-sm bg-white"
            >
              <option value="">Select Sales Partner…</option>
              {choices.map((o) => (
                <option key={o.id} value={o.id}>
                  {label(o.name, o.agentCode)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-600">
            Reason (optional)
            <input
              value={reason}
              maxLength={255}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cream-border px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={!toAgent || busy}
            onClick={() => setConfirming(true)}
            className="rounded-lg bg-secondary-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Saving…" : data?.agent ? "Transfer" : "Assign"}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        variant="default"
        title="Transfer this customer?"
        description={`From ${data?.agent ? label(data.agent.name, data.agent.agentCode) : "no Sales Partner"} to ${label(choices.find((o) => o.id === toAgent)?.name ?? null, choices.find((o) => o.id === toAgent)?.agentCode ?? null)}. Past orders and commissions stay with the original Sales Partner. This is recorded in the history.`}
        confirmText="Transfer"
      />
      {msg && <p className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}

      {data && data.history.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-1 pr-3 font-medium">When</th>
                <th className="py-1 pr-3 font-medium">From</th>
                <th className="py-1 pr-3 font-medium">To</th>
                <th className="py-1 pr-3 font-medium">By</th>
                <th className="py-1 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((h) => (
                <tr key={h.id} className="border-t border-cream-border">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmt(h.at)}</td>
                  <td className="py-1.5 pr-3">{label(h.fromAgentName, h.fromAgentCode)}</td>
                  <td className="py-1.5 pr-3">{label(h.toAgentName, h.toAgentCode)}</td>
                  <td className="py-1.5 pr-3">{h.transferredBy}</td>
                  <td className="py-1.5">{h.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
