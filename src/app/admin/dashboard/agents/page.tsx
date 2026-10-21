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
import type { AgentDto } from "@/features/agents/services/agent.service";
import { errorMessage, useAdminList } from "@/features/agents/hooks/use-admin-agents";
import { AgentFormModal, type EditableAgent } from "@/features/agents/components/admin/AgentFormModal";
import { BlockAgentDialog, type BlockAgentPayload, ButtonPager, Panel, SimpleTable, StatusBadge, TableSkeleton, Tooltip, fieldCls, money } from "@/features/agents/components/shared";

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

  const handleUnblock = async (a: AgentDto) => {
    try {
      await apiClient.put(`/api/admin/agents/${a.id}`, { isActive: true });
      toast.success("Sales Partner unblocked successfully");
      await qc.invalidateQueries({ queryKey: ["agents-admin"] });
    } catch (err) {
      toast.error("Could not unblock the Sales Partner", errorMessage(err));
    }
  };

  const confirmBlock = async (payload: BlockAgentPayload) => {
    if (!blockTarget) return;
    setBlocking(true);
    try {
      await apiClient.put(`/api/admin/agents/${blockTarget.id}`, {
        isActive: false,
        blockReason: payload.reason,
        customerAction: payload.customerAction,
        transferToAgentId: payload.transferToAgentId,
      });
      toast.success(
        payload.customerAction === "transfer"
          ? "Sales Partner blocked and customers transferred successfully"
          : payload.customerAction === "release"
          ? "Sales Partner blocked and customers released to open pool"
          : "Sales Partner blocked successfully"
      );
      await qc.invalidateQueries({ queryKey: ["agents-admin"] });
    } catch (err) {
      toast.error("Could not block the Sales Partner", errorMessage(err));
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
          className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-4 text-sm font-semibold text-white transition-colors"
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
            <div className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-medium text-neutral-600 sm:flex-none">
              <span>Status</span>
              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Blocked" },
                ]}
                className="w-full"
              />
            </div>
            <button type="submit" className="h-10 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-4 text-sm font-semibold text-white transition-colors">
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
                  {
                    header: "Status",
                    cell: (r) => (
                      <StatusBadge
                        status={r.isActive ? "active" : "blocked"}
                        title={!r.isActive && r.blockReason ? `Blocked reason: ${r.blockReason}` : undefined}
                      />
                    ),
                  },
                  {
                    header: "Actions",
                    stickyRight: true,
                    cell: (r) => (
                      <div className="flex items-center gap-1">
                        <Tooltip content="View Sales Partner Details" side="top">
                          <Link href={`/admin/dashboard/agents/${r.id}`} aria-label="View Sales Partner Details" className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Tooltip>
                        <Tooltip content="Edit Sales Partner" side="top">
                          <button
                            type="button"
                            aria-label="Edit Sales Partner"
                            onClick={() =>
                              setModal({
                                open: true,
                                agent: {
                                  id: r.id,
                                  name: r.name,
                                  phone: r.phone,
                                  notes: r.notes,
                                  isActive: r.isActive,
                                  blockReason: r.blockReason,
                                },
                              })
                            }
                            className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </Tooltip>
                        <Tooltip content={r.isActive ? "Block Sales Partner" : "Unblock Sales Partner"} side="top">
                          <button
                            type="button"
                            aria-label={r.isActive ? "Block Sales Partner" : "Unblock Sales Partner"}
                            onClick={() => (r.isActive ? setBlockTarget(r) : handleUnblock(r))}
                            className={r.isActive ? "rounded-lg p-1.5 text-red-600 hover:bg-red-50" : "rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50"}
                          >
                            {r.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </button>
                        </Tooltip>
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

      <BlockAgentDialog
        open={Boolean(blockTarget)}
        agent={blockTarget}
        isLoading={blocking}
        onClose={() => setBlockTarget(null)}
        onConfirm={confirmBlock}
      />
      <AgentFormModal open={modal.open} agent={modal.agent} onClose={() => setModal({ open: false, agent: null })} />
    </PageContainer>
  );
}
