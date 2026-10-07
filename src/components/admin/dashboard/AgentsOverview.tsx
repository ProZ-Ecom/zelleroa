"use client";

import Link from "next/link";
import { UserCheck, UserX, ShieldAlert, Landmark, Wallet, HandCoins, BadgeCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { DashboardAgents } from "@/features/dashboard/api/get-stats";

function Stat({
  icon: Icon,
  label,
  value,
  gradient,
  alert,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  gradient: [string, string];
  alert?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3.5 ${
        alert
          ? "border-yellow-200 bg-yellow-50/60"
          : "border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)]"
      }`}
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
        style={{ backgroundImage: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--color-neutral-500)]">{label}</p>
        <p className="text-base font-bold text-[var(--color-neutral-900)] tabular-nums">{value}</p>
      </div>
    </div>
  );
}

const BLUE: [string, string] = ["var(--primary-500)", "var(--primary-700)"];
const GREEN: [string, string] = ["var(--success-500)", "var(--success-700)"];
const AMBER: [string, string] = ["var(--yellow-400)", "var(--yellow-600)"];
const SLATE: [string, string] = ["var(--neutral-400)", "var(--neutral-600)"];

function AgentsOverview({ agents, periodLabel }: { agents: DashboardAgents; periodLabel: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-neutral-200)]/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-neutral-900)]">
            Agent Performance
          </h3>
          <p className="text-sm text-[var(--color-neutral-500)]">
            Team status and top agents &middot; {periodLabel}
          </p>
        </div>
        <Link
          href="/admin/dashboard/agents"
          className="text-sm font-medium text-[var(--color-primary-600)] hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <Stat icon={UserCheck} label="Active agents" value={agents.active} gradient={GREEN} />
        <Stat icon={UserX} label="Inactive agents" value={agents.inactive} gradient={SLATE} />
        <Stat icon={ShieldAlert} label="KYC pending" value={agents.kycPending} gradient={AMBER} alert={agents.kycPending > 0} />
        <Stat icon={Landmark} label="Bank pending" value={agents.bankPending} gradient={AMBER} alert={agents.bankPending > 0} />
        <Stat icon={HandCoins} label="Commission owed" value={formatPrice(agents.commissionOwed)} gradient={BLUE} />
        <Stat icon={BadgeCheck} label="Commission paid" value={formatPrice(agents.commissionPaid)} gradient={GREEN} />
        <Stat icon={Wallet} label="Payout requested" value={formatPrice(agents.payoutRequested)} gradient={AMBER} alert={agents.payoutRequested > 0} />
      </div>

      <div className="mt-5 overflow-x-auto">
        {agents.topAgents.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-neutral-400)]">
            No agent-referred orders in this period
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-neutral-500)]">
                <th className="rounded-l-lg px-3 py-2.5">Agent</th>
                <th className="px-3 py-2.5">Orders</th>
                <th className="px-3 py-2.5 text-right">Sales</th>
                <th className="rounded-r-lg px-3 py-2.5 text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {agents.topAgents.map((a, i) => (
                <tr
                  key={a.id}
                  className="border-b border-[var(--color-neutral-100)] transition-colors last:border-0 hover:bg-[var(--color-neutral-50)]"
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${BLUE[0]}, ${BLUE[1]})`,
                        }}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <Link
                          href={`/admin/dashboard/agents/${a.id}`}
                          className="font-medium text-[var(--color-neutral-900)] hover:underline"
                        >
                          {a.name}
                        </Link>
                        {a.code && (
                          <p className="font-mono text-xs text-[var(--color-neutral-500)]">
                            {a.code}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-neutral-700)]">{a.orders}</td>
                  <td className="px-3 py-3 text-right font-semibold text-[var(--color-neutral-900)] tabular-nums">
                    {formatPrice(a.sales)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-[var(--color-success-700)] tabular-nums">
                    {formatPrice(a.commission)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export { AgentsOverview };
