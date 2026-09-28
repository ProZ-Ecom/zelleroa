import { agentService } from "@/features/agents/services/agent.service";
import { payoutService } from "@/features/agents/services/payout.service";
import { pageParam, pickParams, requireAgentPage } from "@/features/agents/lib/page-context";
import { RequestPayoutForm } from "@/features/agents/components/RequestPayoutForm";
import {
  FilterForm,
  LinkPager,
  PAYOUT_STATUS_OPTIONS,
  Panel,
  SimpleTable,
  StatusBadge,
  dateOnly,
  money,
} from "@/features/agents/components/shared";

export const metadata = { title: "Payouts" };

export default async function AgentPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { agentId } = await requireAgentPage("/agent/payouts");
  const sp = await searchParams;
  const filters = pickParams(sp, ["status", "dateFrom", "dateTo"]);
  const page = pageParam(sp);

  const [balance, profile, history] = await Promise.all([
    payoutService.availableBalance(agentId),
    agentService.getProfile(agentId),
    payoutService.list({ ...filters, page, limit: 20 }, { agentId }),
  ]);

  const p = profile.payment;
  const bankSummary = p.hasBank ? `${p.bankName} · ${p.accountNumberMasked}` : null;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Payouts</h1>
        <p className="text-sm text-neutral-500">Request a payout of your approved commission. Every payout is reviewed by the admin before it is paid.</p>
      </div>

      <Panel title="Request payout">
        <RequestPayoutForm
          amount={balance.amount}
          commissionCount={balance.count}
          hasUpi={p.hasUpi}
          hasBank={p.hasBank}
          preferredMethod={p.preferredMethod}
          upiId={p.upiId}
          bankSummary={bankSummary}
        />
      </Panel>

      <Panel title="Payout history">
        <FilterForm
          action="/agent/payouts"
          values={filters}
          fields={[
            { name: "status", label: "Status", type: "select", options: PAYOUT_STATUS_OPTIONS },
            { name: "dateFrom", label: "From", type: "date" },
            { name: "dateTo", label: "To", type: "date" },
          ]}
        />
        <SimpleTable
          rows={history.data}
          rowKey={(r) => r.id}
          empty="No payouts yet."
          columns={[
            { header: "Payout ID", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { header: "Amount", cell: (r) => <strong>{money(r.amount)}</strong> },
            { header: "Method", cell: (r) => (r.method === "upi" ? "UPI" : "Bank transfer") },
            { header: "Requested", cell: (r) => dateOnly(r.requestedAt) },
            { header: "Approved", cell: (r) => dateOnly(r.reviewedAt) },
            { header: "Paid", cell: (r) => dateOnly(r.paidAt) },
            { header: "Reference", cell: (r) => r.transactionReference ?? "—" },
            {
              header: "Status",
              cell: (r) => (
                <div className="flex flex-col gap-1">
                  <StatusBadge status={r.status} />
                  {r.rejectionReason && (
                    <span className="max-w-[14rem] text-[11px] text-red-600" title={r.rejectionReason}>
                      {r.rejectionReason}
                    </span>
                  )}
                </div>
              ),
            },
          ]}
        />
        <LinkPager basePath="/agent/payouts" params={filters} page={history.meta.page} totalPages={history.meta.totalPages} total={history.meta.total} />
      </Panel>
    </>
  );
}
