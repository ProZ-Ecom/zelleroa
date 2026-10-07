"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Pencil } from "lucide-react";
import { apiClient } from "@/lib/api/api-client";
import { toast } from "@/components/ui/Toast";
import { PageContainer } from "@/components/admin/PageContainer";
import { BlockReasonDialog } from "@/components/ui/block-reason-dialog";
import type { AgentDto } from "@/features/agents/services/agent.service";
import { errorMessage, useAdminObject } from "@/features/agents/hooks/use-admin-agents";
import { AgentFormModal } from "@/features/agents/components/admin/AgentFormModal";
import { AdminCommissionsSection } from "@/features/agents/components/admin/AdminCommissionsSection";
import { AdminOwnPurchasesSection } from "@/features/agents/components/admin/AdminOwnPurchasesSection";
import { AdminProfileSection } from "@/features/agents/components/admin/AdminProfileSection";
import { AdminAssignedCustomersSection } from "@/features/agents/components/admin/AdminAssignedCustomersSection";
import { AdminOrdersSection } from "@/features/agents/components/admin/AdminOrdersSection";
import { AdminPayoutsSection } from "@/features/agents/components/admin/AdminPayoutsSection";
import { ReferralFlow } from "@/features/agents/components/ReferralFlow";
import { MetricCard, Panel, StatusBadge, dateOnly, money } from "@/features/agents/components/shared";

const TABS = [
  { key: "profile", label: "Profile & KYC" },
  { key: "customers", label: "Assigned customers" },
  { key: "orders", label: "Referral orders" },
  { key: "purchases", label: "Own purchases" },
  { key: "commissions", label: "Commissions" },
  { key: "payouts", label: "Payouts" },
] as const;

export default function AdminAgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("profile");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: agent, isLoading, error } = useAdminObject<AgentDto>("agent", `/api/admin/agents/${id}`);

  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const toggleActive = async (blockReason?: string) => {
    if (!agent) return;
    setBlocking(true);
    try {
      await apiClient.put(`/api/admin/agents/${agent.id}`, agent.isActive ? { isActive: false, blockReason } : { isActive: true });
      toast.success(agent.isActive ? "Sales Partner blocked" : "Sales Partner unblocked");
      await qc.invalidateQueries({ queryKey: ["agents-admin"] });
    } catch (err) {
      toast.error("Could not update the Sales Partner", errorMessage(err));
    } finally {
      setBlocking(false);
      setBlockOpen(false);
    }
  };

  const copyLink = async () => {
    if (!agent?.referralLink) return;
    try {
      await navigator.clipboard.writeText(agent.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <PageContainer
      title={agent ? agent.name : "Sales Partner"}
      description={agent ? `${agent.agentCode ?? ""} · ${agent.email ?? ""}` : undefined}
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Sales Partners", href: "/admin/dashboard/agents" }, { label: agent?.name ?? "Sales Partner" }]}
      actions={
        agent && (
          <>
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 px-4 text-sm font-medium hover:bg-neutral-50">
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button
              type="button"
              onClick={() => (agent.isActive ? setBlockOpen(true) : toggleActive())}
              className={`h-10 rounded-xl px-4 text-sm font-semibold ${agent.isActive ? "border border-red-200 text-red-700 hover:bg-red-50" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
            >
              {agent.isActive ? "Block" : "Unblock"}
            </button>
          </>
        )
      }
    >
      {error ? (
        <p className="py-10 text-center text-sm text-red-600">{errorMessage(error)}</p>
      ) : isLoading || !agent ? (
        <p className="py-10 text-center text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Assigned customers" value={agent.summary.totalReferredCustomers} />
            <MetricCard label="Active assigned customers" value={agent.summary.activeCustomers} />
            <MetricCard label="Orders" value={agent.summary.totalOrders} />
            <MetricCard label="Customer direct orders" value={agent.summary.customerDirectOrders} />
            <MetricCard label="Agent placed orders" value={agent.summary.agentPlacedOrders} />
            <MetricCard label="Agent own orders" value={agent.summary.agentOwnOrders} />
            <MetricCard label="Total sales" value={money(agent.summary.totalSales)} />
            <MetricCard label="Total commission" value={money(agent.summary.totalCommission)} />
            <MetricCard label="Pending" value={money(agent.summary.pendingCommission)} tone="warn" />
            <MetricCard label="Approved" value={money(agent.summary.approvedCommission)} tone="good" />
            <MetricCard label="Paid" value={money(agent.summary.paidCommission)} tone="good" />
            <MetricCard label="Cancelled" value={money(agent.summary.cancelledCommission)} />
            <MetricCard label="Open payout requests" value={agent.summary.openPayouts} />
          </div>

          {!agent.isActive && agent.summary.totalReferredCustomers > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>
                Blocked, but still holds <strong>{agent.summary.totalReferredCustomers}</strong> assigned customer(s). Move them to an active Sales Partner.
              </span>
              <button type="button" onClick={() => setTab("customers")} className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700">
                View &amp; reassign
              </button>
            </div>
          )}

          <Panel title="Profile & referral">
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Sales Partner ID", agent.agentCode ?? "—"],
                  ["Referral code", agent.referralCode ?? "—"],
                  ["Email", agent.email ?? "—"],
                  ["Phone", agent.phone ?? "—"],
                  ["Created", dateOnly(agent.createdAt)],
                  ["Last login", dateOnly(agent.lastLoginAt)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-neutral-500">{k}</dt>
                    <dd className="break-all font-medium text-neutral-900">{v}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs text-neutral-500">Status</dt>
                  <dd>
                    <StatusBadge status={agent.isActive ? "active" : "blocked"} />
                  </dd>
                </div>
                {!agent.isActive && (
                  <div className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <dt className="text-xs font-semibold text-red-700">
                      Block reason{agent.blockedAt ? ` · blocked on ${dateOnly(agent.blockedAt)}` : ""}
                    </dt>
                    <dd className="break-words text-sm text-red-900">{agent.blockReason ?? "No reason recorded"}</dd>
                  </div>
                )}
                {agent.notes && (
                  <div className="col-span-2">
                    <dt className="text-xs text-neutral-500">Notes</dt>
                    <dd className="text-neutral-700">{agent.notes}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-neutral-500">Referral link</p>
                <div className="flex items-center gap-2">
                  <input readOnly value={agent.referralLink ?? ""} onFocus={(e) => e.currentTarget.select()} className="h-10 w-full min-w-0 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm" />
                  <button type="button" onClick={copyLink} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-neutral-200 px-3 text-sm font-medium hover:bg-neutral-50">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-neutral-500">Short form: <span className="font-mono">/ref/{agent.referralCode}</span></p>
              </div>
            </div>
          </Panel>

          <ReferralFlow />

          <div className="flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`min-h-[40px] whitespace-nowrap rounded-lg px-4 text-sm font-medium ${tab === t.key ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "profile" && <AdminProfileSection agentId={agent.id} />}
          {tab === "customers" && <AdminAssignedCustomersSection agentId={agent.id} agentActive={agent.isActive} />}
          {tab === "purchases" && <AdminOwnPurchasesSection agentId={agent.id} />}
          {tab === "orders" && <AdminOrdersSection fixedAgent={agent.id} />}
          {tab === "commissions" && <AdminCommissionsSection fixedAgent={agent.id} allowApprove={false} />}
          {tab === "payouts" && <AdminPayoutsSection fixedAgent={agent.id} />}
        </div>
      )}

      <BlockReasonDialog
        open={blockOpen}
        subject="Agent"
        name={agent?.name}
        isLoading={blocking}
        onClose={() => setBlockOpen(false)}
        onConfirm={(reason) => toggleActive(reason)}
      />
      <AgentFormModal
        open={editing}
        onClose={() => setEditing(false)}
        agent={agent ? { id: agent.id, name: agent.name, phone: agent.phone, notes: agent.notes } : null}
      />
    </PageContainer>
  );
}
