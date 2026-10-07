"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AgentCustomerRow } from "../../services/agent.service";
import { errorMessage, useAdminList, useAgentOptions } from "../../hooks/use-admin-agents";
import { ButtonPager, Panel, SimpleTable, StatusBadge, TableSkeleton, dateOnly, money } from "../shared";

interface ReassignResult {
  moved: number;
  failed: { customerId: string; message: string }[];
}

/**
 * Admin: customers currently assigned to this Sales Partner, with a way to move them to another
 * active Sales Partner. A blocked partner keeps their customers until an admin does this.
 */
export function AdminAssignedCustomersSection({ agentId, agentActive }: { agentId: string; agentActive: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toAgent, setToAgent] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<"selected" | "all" | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, error } = useAdminList<AgentCustomerRow>("assigned-customers", `/api/admin/agents/${agentId}/customers`, { page, limit: 20 });
  const { data: options } = useAgentOptions();
  const choices = (options ?? []).filter((o) => o.isActive && o.id !== agentId);
  const target = choices.find((o) => o.id === toAgent);
  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function run(mode: "selected" | "all") {
    setConfirming(null);
    if (!toAgent) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiClient.post<ReassignResult>(`/api/admin/agents/${agentId}/customers/reassign`, {
        toAgentId: toAgent,
        customerIds: mode === "selected" ? [...selected] : undefined,
        reason: reason.trim() || undefined,
      });
      const r = res.data as ReassignResult;
      setMsg({
        ok: r.failed.length === 0,
        text: `${r.moved} customer(s) moved.${r.failed.length ? ` ${r.failed.length} failed: ${r.failed[0].message}.` : ""} Past orders and commissions stay with this Sales Partner.`,
      });
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["agents-admin"] });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={`Assigned customers (${total})`}>
      {!agentActive && total > 0 && (
        <p className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:mx-5">
          This Sales Partner is blocked, but these {total} customer(s) are still assigned to them. New orders from them earn no
          commission until you move them to an active Sales Partner.
        </p>
      )}

      {total > 0 && (
        <div className="grid items-end gap-2 p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:p-5">
          <label className="text-xs text-neutral-600">
            Move to
            <select value={toAgent} onChange={(e) => setToAgent(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
              <option value="">Select active Sales Partner…</option>
              {choices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.agentCode ? ` (${o.agentCode})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-600">
            Reason (optional)
            <input value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <button
            type="button"
            disabled={!toAgent || selected.size === 0 || busy}
            onClick={() => setConfirming("selected")}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Move selected ({selected.size})
          </button>
          <button
            type="button"
            disabled={!toAgent || busy}
            onClick={() => setConfirming("all")}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Move all ({total})
          </button>
        </div>
      )}
      {msg && <p className={`px-4 pb-3 text-xs sm:px-5 ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}

      {error ? (
        <p className="px-5 py-10 text-center text-sm text-red-600">{errorMessage(error)}</p>
      ) : isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          <SimpleTable
            rows={rows}
            rowKey={(r) => r.id}
            empty="No customers are assigned to this Sales Partner."
            columns={[
              {
                header: "",
                cell: (r) => <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />,
              },
              { header: "Customer", cell: (r) => <strong>{r.name}</strong> },
              { header: "ID", cell: (r) => <span className="font-mono text-xs">{r.customerCode ?? "—"}</span> },
              { header: "Mobile", cell: (r) => r.phone ?? "—" },
              { header: "Email", cell: (r) => r.email ?? "—" },
              { header: "Orders", cell: (r) => r.totalOrders },
              { header: "Sales", cell: (r) => money(r.totalSales) },
              { header: "Last order", cell: (r) => dateOnly(r.lastOrderAt) },
              { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            ]}
          />
          <ButtonPager page={page} totalPages={data?.meta.totalPages ?? 1} total={total} onPage={setPage} />
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && run(confirming)}
        variant="default"
        title="Move customers?"
        description={`${confirming === "all" ? `All ${total}` : selected.size} customer(s) will move to ${target ? target.name : "the selected Sales Partner"}. Past orders and commissions stay with the original Sales Partner. Each move is recorded in the customer's history.`}
        confirmText="Move"
      />
    </Panel>
  );
}
