"use client";
import { ReferralFlow } from "@/features/agents/components/ReferralFlow";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Eye, Pencil, Plus } from "lucide-react";
import { apiClient } from "@/lib/api/api-client";
import { toast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/select";
import { PageContainer } from "@/components/admin/PageContainer";
import { BlockReasonDialog } from "@/components/ui/block-reason-dialog";
import type { AgentDto } from "@/features/agents/services/agent.service";
import { errorMessage, useAdminList } from "@/features/agents/hooks/use-admin-agents";
import { AgentFormModal, type EditableAgent } from "@/features/agents/components/admin/AgentFormModal";
import { ButtonPager, Panel, SimpleTable, StatusBadge, TableSkeleton, fieldCls, money } from "@/features/agents/components/shared";

export default function AdminAgentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; agent: EditableAgent | null }>({ open: false, agent: null });

  const { data, isLoading, error } = useAdminList<AgentDto>("agents", "/api/admin/agents", { search, status, page, limit: 20 });

  const [blockTarget, setBlockTarget] = useState<AgentDto | null>(null);
  const [blocking, setBlocking] = useState(false);

  const toggleActive = async (a: AgentDto, blockReason?: string) => {
    try {
      await apiClient.put(`/api/admin/agents/${a.id}`, a.isActive ? { isActive: false, blockReason } : { isActive: true });
      toast.success(a.isActive ? "Sales Partner blocked" : "Sales Partner unblocked");
      await qc.invalidateQueries({ queryKey: ["agents-admin"] });
    } catch (err) {
      toast.error("Could not update the Sales Partner", errorMessage(err));
    }
  };

  const confirmBlock = async (reason: string) => {
    if (!blockTarget) return;
    setBlocking(true);
    try {
      await toggleActive(blockTarget, reason);
    } finally {
      setBlocking(false);
      setBlockTarget(null);
    }
  };

  return (
    <PageContainer
      title="Sales Partners"
      description="Create Sales Partners, share their referral links, and track their customers, sales and commission."
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Sales Partners" }]}
      actions={
        <button
          type="button"
          onClick={() => setModal({ open: true, agent: null })}
          className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-secondary-600 px-4 text-sm font-semibold text-white hover:bg-secondary-700"
        >
          <Plus className="h-4 w-4" /> Create Sales Partner
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <Panel>
          <form
            className="flex flex-wrap items-end gap-3 px-4 py-3 sm:px-5"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(draftSearch);
              setPage(1);
            }}
          >
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-neutral-600 sm:flex-none">
              Search
              <input className={fieldCls} value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} placeholder="Name, email, phone or AGT001" />
            </label>
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-medium text-neutral-600 sm:flex-none">
              Status
              <select
                className={fieldCls}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Blocked</option>
              </select>
            </label>
            <button type="submit" className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800">
              Search
            </button>
          </form>

          {error ? (
            <p className="px-5 py-10 text-center text-sm text-red-600">{errorMessage(error)}</p>
          ) : isLoading ? (
            <TableSkeleton />
          ) : (
            <>
              <SimpleTable
                rows={data?.data ?? []}
                rowKey={(r) => r.id}
                empty="No Sales Partners yet. Click “Create Sales Partner” to add the first one."
                columns={[
                  {
                    header: "Sales Partner",
                    cell: (r) => (
                      <Link href={`/admin/dashboard/agents/${r.id}`} className="group flex flex-col">
                        <span className="font-semibold text-neutral-900 group-hover:underline">{r.name}</span>
                        <span className="text-xs text-neutral-500">{r.email}</span>
                      </Link>
                    ),
                  },
                  { header: "Sales Partner ID", cell: (r) => <span className="font-mono text-xs">{r.agentCode ?? "—"}</span> },
                  { header: "Referral code", cell: (r) => <span className="font-mono text-xs">{r.referralCode ?? "—"}</span> },
                  { header: "Customers", cell: (r) => r.summary.totalReferredCustomers },
                  { header: "Orders", cell: (r) => r.summary.totalOrders },
                  { header: "Sales", cell: (r) => money(r.summary.totalSales) },
                  { header: "Pending", cell: (r) => money(r.summary.pendingCommission) },
                  { header: "Approved", cell: (r) => money(r.summary.approvedCommission) },
                  { header: "Paid", cell: (r) => money(r.summary.paidCommission) },
                  { header: "Open payouts", cell: (r) => r.summary.openPayouts },
                  { header: "Status", cell: (r) => (
                      <div className="flex max-w-[220px] flex-col items-start gap-1">
                        <StatusBadge status={r.isActive ? "active" : "blocked"} />
                        {!r.isActive && r.blockReason && (
                          <span className="line-clamp-2 text-[11px] leading-snug text-neutral-500" title={r.blockReason}>
                            Reason: {r.blockReason}
                          </span>
                        )}
                      </div>
                    ),
                  },
                  {
                    header: "Actions",
                    stickyRight: true,
                    cell: (r) => (
                      <div className="flex items-center gap-1">
                        <Link href={`/admin/dashboard/agents/${r.id}`} title="View" aria-label="View" className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button type="button" title="Edit" aria-label="Edit" onClick={() => setModal({ open: true, agent: { id: r.id, name: r.name, phone: r.phone, notes: r.notes } })} className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" title={r.isActive ? "Block" : "Unblock"} aria-label={r.isActive ? "Block" : "Unblock"} onClick={() => (r.isActive ? setBlockTarget(r) : toggleActive(r))} className={r.isActive ? "rounded-lg p-1.5 text-red-600 hover:bg-red-50" : "rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50"}>
                          {r.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
              <ButtonPager page={page} totalPages={data?.meta.totalPages ?? 1} total={data?.meta.total ?? 0} onPage={setPage} />
            </>
          )}
        </Panel>
      </div>

      <BlockReasonDialog
        open={Boolean(blockTarget)}
        subject="Agent"
        name={blockTarget?.name}
        isLoading={blocking}
        onClose={() => setBlockTarget(null)}
        onConfirm={confirmBlock}
      />
      <AgentFormModal open={modal.open} agent={modal.agent} onClose={() => setModal({ open: false, agent: null })} />
    </PageContainer>
  );
}
