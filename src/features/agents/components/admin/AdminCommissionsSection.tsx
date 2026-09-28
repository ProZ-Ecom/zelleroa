"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/api-client";
import { toast } from "@/components/ui/Toast";
import type { CommissionRow } from "../../types";
import { errorMessage, useAdminList } from "../../hooks/use-admin-agents";
import {
  ButtonPager,
  COMMISSION_STATUS_OPTIONS,
  ORDER_STATUS_OPTIONS,
  Panel,
  SimpleTable,
  StatusBadge,
  dateOnly,
  money,
  pct, TableSkeleton } from "../shared";
import { AdminFilterBar, type FilterField } from "./AdminFilterBar";
import { AuditModal } from "./AuditModal";

/** Commission ledger. `fixedAgent` pins it to one agent (used on the agent detail page). */
export function AdminCommissionsSection({ fixedAgent, allowApprove = true }: { fixedAgent?: string; allowApprove?: boolean }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const params = { ...filters, ...(fixedAgent ? { agent: fixedAgent } : {}), page, limit: 20 };
  const { data, isLoading, error } = useAdminList<CommissionRow>("commissions", "/api/admin/commissions", params);

  const fields: FilterField[] = [
    ...(fixedAgent ? [] : [{ name: "agent", label: "Agent", type: "agent" as const }]),
    { name: "order", label: "Order", type: "text" },
    { name: "referralCode", label: "Referral code", type: "text" },
    { name: "customer", label: "Customer", type: "text" },
    { name: "status", label: "Commission status", type: "select", options: COMMISSION_STATUS_OPTIONS },
    { name: "orderStatus", label: "Order status", type: "select", options: ORDER_STATUS_OPTIONS },
    { name: "dateFrom", label: "From", type: "date" },
    { name: "dateTo", label: "To", type: "date" },
  ];

  const approveEligible = async () => {
    setApproving(true);
    try {
      const res = await apiClient.post<{ approved: number }>("/api/admin/commissions/approve-eligible");
      toast.success(res.message ?? "Done");
      await qc.invalidateQueries({ queryKey: ["agents-admin"] });
    } catch (err) {
      toast.error("Could not approve commissions", errorMessage(err));
    } finally {
      setApproving(false);
    }
  };

  return (
    <Panel
      title="Commissions"
      action={
        allowApprove && (
          <button
            type="button"
            onClick={approveEligible}
            disabled={approving}
            className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-neutral-200 px-3 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-60"
            title="Approve every commission whose return period has ended"
          >
            {approving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Approve eligible now
          </button>
        )
      }
    >
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
            empty="No commissions match these filters."
            columns={[
              { header: "Commission", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
              ...(fixedAgent ? [] : [{ header: "Agent", cell: (r: CommissionRow) => `${r.agentName}${r.agentCode ? ` (${r.agentCode})` : ""}` }]),
              { header: "Order", cell: (r) => <span className="font-mono text-xs">{r.orderNumber}</span> },
              { header: "Referral code", cell: (r) => <span className="font-mono text-xs">{r.referralCode ?? "—"}</span> },
              { header: "Customer", cell: (r) => r.customerName },
              { header: "Product", cell: (r) => `${r.productName} × ${r.quantity}` },
              { header: "Category", cell: (r) => r.categoryName ?? "—" },
              { header: "Product amount", cell: (r) => money(r.productAmount) },
              { header: "%", cell: (r) => <span title={`Rate source: ${r.rateSource}`}>{pct(r.percentage)}</span> },
              { header: "Commission", cell: (r) => <strong>{money(r.amount)}</strong> },
              {
                header: "Status",
                cell: (r) => (
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={r.status} />
                    {r.clawbackDue && <span className="text-[11px] font-semibold text-red-600">Clawback due</span>}
                  </div>
                ),
              },
              { header: "Order status", cell: (r) => <StatusBadge status={r.orderStatus} /> },
              { header: "Order date", cell: (r) => dateOnly(r.createdAt) },
              { header: "Eligible on", cell: (r) => dateOnly(r.eligibleAt) },
              { header: "Approved", cell: (r) => dateOnly(r.approvedAt) },
              { header: "Paid", cell: (r) => dateOnly(r.paidAt) },
              { header: "Payout", cell: (r) => r.payoutCode ?? "—" },
              {
                header: "",
                cell: (r) => (
                  <button type="button" onClick={() => setAuditId(r.id)} className="text-xs font-semibold text-neutral-700 underline-offset-4 hover:underline">
                    History
                  </button>
                ),
              },
            ]}
          />
          <ButtonPager page={page} totalPages={data?.meta.totalPages ?? 1} total={data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
      <AuditModal type="commission" id={auditId} title="Commission history" onClose={() => setAuditId(null)} />
    </Panel>
  );
}
