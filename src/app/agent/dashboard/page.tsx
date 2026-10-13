import Link from "next/link";
import { BadgeCheck, CheckCircle2, Clock, Coins, ShoppingBag, TrendingUp, Users, Wallet, ArrowRight, Handshake, Pencil } from "lucide-react";
import { agentService } from "@/features/agents/services/agent.service";
import { commissionService } from "@/features/agents/services/commission.service";
import { payoutService } from "@/features/agents/services/payout.service";
import { requireAgentPage } from "@/features/agents/lib/page-context";
import { ReferralFlow } from "@/features/agents/components/ReferralFlow";
import { ReferralLinkCard } from "@/features/agents/components/ReferralLinkCard";
import {
  CollapsiblePanel,
  MetricCard,
  PageHeader,
  Panel,
  SimpleTable,
  StatusBadge,
  dateOnly,
  money,
  pct,
} from "@/features/agents/components/shared";

export const metadata = { title: "Sales Partner Dashboard" };

const viewAll = (href: string) => (
  <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 transition-colors hover:text-neutral-900">
    View all <ArrowRight className="h-3.5 w-3.5" />
  </Link>
);

function SectionHeading({ title, description, tone }: { title: string; description: string; tone: "personal" | "partner" }) {
  const Icon = Handshake;
  return (
    <div className="flex items-center gap-3 pt-2">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          tone === "personal" ? "bg-neutral-900 text-white" : "bg-emerald-600 text-white"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-neutral-900">{title}</h2>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      <div className="ml-2 hidden h-px flex-1 bg-gradient-to-r from-neutral-200 to-transparent sm:block" aria-hidden />
    </div>
  );
}

export default async function AgentDashboardPage() {
  const { agentId, name } = await requireAgentPage("/agent/dashboard");

  // Approve anything whose return period has ended before we total it up.
  await commissionService.markReadyForApproval({ agentId });

  const [profile, summary, balance, customers, orders, commissions, payouts] = await Promise.all([
    agentService.getProfile(agentId),
    agentService.getSummary(agentId),
    payoutService.availableBalance(agentId, { skipSweep: true }),
    agentService.listCustomers(agentId, { limit: 5 }),
    agentService.listOrderLines({ limit: 5 }, { agentId }),
    commissionService.list({ limit: 5 }, { agentId }),
    payoutService.list({ limit: 5 }, { agentId }),
  ]);

  return (
    <>
      <PageHeader title={`Welcome back, ${name}`} description="Here’s how your referrals are performing.">
        <div className="flex flex-wrap items-center gap-2">
          {profile.agentCode && (
            <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
              Agent ID <span className="font-mono font-semibold text-neutral-900">{profile.agentCode}</span>
            </span>
          )}
          <Link
            href="/agent/profile"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-neutral-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit profile
          </Link>
        </div>
      </PageHeader>

      <SectionHeading
        title="Sales Partner Business"
        description="Orders and earnings from customers who used your referral code."
        tone="partner"
      />

      {profile.referralCode && profile.referralLink && (
        <ReferralLinkCard referralCode={profile.referralCode} referralLink={profile.referralLink} />
      )}

      <ReferralFlow />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard icon={Users} label="Assigned customers" value={summary.totalReferredCustomers} hint={`${summary.activeCustomers} active`} />
        <MetricCard icon={ShoppingBag} label="Orders" value={summary.totalOrders} hint={`${summary.customerDirectOrders} direct · ${summary.agentPlacedOrders} placed · ${summary.agentOwnOrders} own`} />
        <MetricCard icon={TrendingUp} label="Referral sales" value={money(summary.totalSales)} hint="Product value, excl. delivery" />
        <MetricCard icon={Coins} label="Total commission" value={money(summary.totalCommission)} />
        <MetricCard icon={Clock} label="Pending commission" value={money(summary.pendingCommission)} tone="warn" hint="Return period / admin approval" />
        <MetricCard icon={CheckCircle2} label="Approved commission" value={money(summary.approvedCommission)} tone="good" hint="Ready / in payout" />
        <MetricCard icon={BadgeCheck} label="Paid commission" value={money(summary.paidCommission)} tone="good" />
        <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 text-white shadow-sm">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100">Available for payout</p>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                <Wallet className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{money(balance.amount)}</p>
          </div>
          <Link
            href="/agent/payouts"
            className="mt-3 inline-flex min-h-[36px] items-center justify-center rounded-lg bg-white px-3 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-50"
          >
            {balance.amount > 0 ? "Request payout" : "Payout history"}
          </Link>
        </div>
      </div>

      <Panel title="Recent commissions" action={viewAll("/agent/commissions")}>
        <SimpleTable
          rows={commissions.data}
          rowKey={(r) => r.id}
          empty="No commissions yet. They appear when your customers place orders."
          columns={[
            { header: "Commission", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { header: "Order", cell: (r) => <span className="font-mono text-xs">{r.orderNumber}</span> },
            { header: "Customer", cell: (r) => r.customerName },
            { header: "Product", cell: (r) => r.productName },
            { header: "Category", cell: (r) => r.categoryName ?? "—" },
            { header: "Amount", cell: (r) => money(r.productAmount) },
            { header: "%", cell: (r) => pct(r.percentage) },
            { header: "Commission", cell: (r) => <strong>{money(r.amount)}</strong> },
            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { header: "Order date", cell: (r) => dateOnly(r.createdAt) },
          ]}
        />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Customers who ordered with your code" action={viewAll("/agent/customers")}>
          <SimpleTable
            rows={customers.data}
            rowKey={(r) => r.id}
            empty="No customers yet. Share your referral link to get started."
            columns={[
              { header: "Customer", cell: (r) => r.name },
              { header: "Last order", cell: (r) => dateOnly(r.lastOrderAt) },
              { header: "Orders", cell: (r) => r.totalOrders },
              { header: "Commission", cell: (r) => money(r.commissionGenerated) },
            ]}
          />
        </Panel>

        <Panel title="Recent orders" action={viewAll("/agent/orders")}>
          <SimpleTable
            rows={orders.data}
            rowKey={(r) => r.id}
            empty="No orders from your customers yet."
            columns={[
              { header: "Order", cell: (r) => <span className="font-mono text-xs">{r.orderNumber}</span> },
              { header: "Product", cell: (r) => r.productName },
              { header: "Amount", cell: (r) => money(r.productAmount) },
              { header: "Status", cell: (r) => <StatusBadge status={r.orderStatus} /> },
            ]}
          />
        </Panel>
      </div>

      <CollapsiblePanel title="Payout history" action={viewAll("/agent/payouts")}>
        <SimpleTable
          rows={payouts.data}
          rowKey={(r) => r.id}
          empty="No payouts requested yet."
          columns={[
            { header: "Payout", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { header: "Amount", cell: (r) => <strong>{money(r.amount)}</strong> },
            { header: "Method", cell: (r) => (r.method === "upi" ? "UPI" : "Bank transfer") },
            { header: "Requested", cell: (r) => dateOnly(r.requestedAt) },
            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      </CollapsiblePanel>
    </>
  );
}
