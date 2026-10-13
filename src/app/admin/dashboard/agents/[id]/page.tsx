"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Banknote, Check, CheckCircle2, Clock, Copy, IndianRupee, Mail, Pencil, Phone, ShoppingBag, UserCheck, Users, Wallet } from "lucide-react";
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
          <Panel className="overflow-visible">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-900 text-lg font-bold text-white">
                {agent.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold tracking-tight text-neutral-900">{agent.name}</h2>
                  <StatusBadge status={agent.isActive ? "active" : "blocked"} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
                  <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-neutral-400" />{agent.agentCode ?? "—"}</span>
                  <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-neutral-400" />{agent.email ?? "—"}</span>
                  <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-neutral-400" />{agent.phone ?? "—"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:text-right">
                <div><p className="text-xs text-neutral-500">Created</p><p className="font-medium">{dateOnly(agent.createdAt)}</p></div>
                <div><p className="text-xs text-neutral-500">Last login</p><p className="font-medium">{dateOnly(agent.lastLoginAt)}</p></div>
              </div>
            </div>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Customers" className="lg:col-span-1">
              <div className="grid grid-cols-2 gap-3 p-4">
                <MetricCard icon={Users} label="Assigned" value={agent.summary.totalReferredCustomers} />
                <MetricCard icon={UserCheck} label="Active" value={agent.summary.activeCustomers} tone="good" />
              </div>
            </Panel>
            <Panel title="Orders & sales" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                <MetricCard icon={ShoppingBag} label="Orders" value={agent.summary.totalOrders} />
                <MetricCard label="Customer direct" value={agent.summary.customerDirectOrders} />
                <MetricCard label="Partner placed" value={agent.summary.agentPlacedOrders} />
                <MetricCard label="Partner own" value={agent.summary.agentOwnOrders} />
              </div>
            </Panel>
          </div>

          <Panel title="Earnings">
            <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4 xl:grid-cols-7">
              <MetricCard icon={IndianRupee} label="Total sales" value={money(agent.summary.totalSales)} />
              <MetricCard icon={Wallet} label="Total commission" value={money(agent.summary.totalCommission)} />
              <MetricCard icon={Clock} label="Pending" value={money(agent.summary.pendingCommission)} tone="warn" />
              <MetricCard icon={CheckCircle2} label="Approved" value={money(agent.summary.approvedCommission)} tone="good" />
              <MetricCard icon={Banknote} label="Paid" value={money(agent.summary.paidCommission)} tone="good" />
              <MetricCard label="Cancelled" value={money(agent.summary.cancelledCommission)} />
              <MetricCard label="Open payouts" value={agent.summary.openPayouts} tone={agent.summary.openPayouts > 0 ? "warn" : "default"} />
            </div>
          </Panel>

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

          <Panel title="Referral">
            <div className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
                <div>
                  <p className="text-xs font-medium text-neutral-500">Referral code</p>
                  <p className="mt-1 inline-block rounded-xl bg-neutral-100 px-3 py-2 font-mono text-sm font-semibold">{agent.referralCode ?? "—"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-neutral-500">Referral link</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input readOnly value={agent.referralLink ?? ""} onFocus={(e) => e.currentTarget.select()} className="h-10 w-full min-w-0 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm" />
                    <button type="button" onClick={copyLink} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-neutral-200 px-3 text-sm font-medium hover:bg-neutral-50">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">Short form: <span className="font-mono">/ref/{agent.referralCode}</span></p>
                </div>
              </div>
              {!agent.isActive && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-xs font-semibold text-red-700">
                    Block reason{agent.blockedAt ? ` · blocked on ${dateOnly(agent.blockedAt)}` : ""}
                  </p>
                  <p className="break-words text-sm text-red-900">{agent.blockReason ?? "No reason recorded"}</p>
                </div>
              )}
              {agent.notes && (
                <div>
                  <p className="text-xs text-neutral-500">Notes</p>
                  <p className="text-sm text-neutral-700">{agent.notes}</p>
                </div>
              )}
            </div>
          </Panel>

          <ReferralFlow />

          <div className="flex gap-1 overflow-x-auto border-b border-neutral-200" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px min-h-[44px] whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition-colors ${tab === t.key ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}
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
