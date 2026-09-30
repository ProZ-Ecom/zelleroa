import { commissionService } from "@/features/agents/services/commission.service";
import { getReturnPeriodDays } from "@/features/agents/services/commission.service";
import { pageParam, pickParams, requireAgentPage } from "@/features/agents/lib/page-context";
import {
  COMMISSION_STATUS_OPTIONS,
  FilterForm,
  LinkPager,
  PageHeader,
  Panel,
  SimpleTable,
  StatusBadge,
  dateOnly,
  money,
  pct,
} from "@/features/agents/components/shared";

export const metadata = { title: "My Commissions" };

export default async function AgentCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { agentId } = await requireAgentPage("/agent/commissions");
  const sp = await searchParams;
  const filters = pickParams(sp, ["order", "referralCode", "customer", "status", "dateFrom", "dateTo"]);
  const page = pageParam(sp);

  await commissionService.approveEligible({ agentId });
  const [result, returnDays] = await Promise.all([
    commissionService.list({ ...filters, page, limit: 20 }, { agentId }),
    getReturnPeriodDays(),
  ]);

  return (
    <>
      <PageHeader
        title="My Commissions"
        description={`Commission is calculated on the product amount only (delivery excluded). It becomes payable ${returnDays} day${returnDays === 1 ? "" : "s"} after delivery, once the return period is over. Cancelled or returned orders earn nothing.`}
      />

      <Panel>
        <FilterForm
          action="/agent/commissions"
          values={filters}
          fields={[
            { name: "order", label: "Order" },
            { name: "referralCode", label: "Referral code" },
            { name: "customer", label: "Customer" },
            { name: "status", label: "Status", type: "select", options: COMMISSION_STATUS_OPTIONS },
            { name: "dateFrom", label: "From", type: "date" },
            { name: "dateTo", label: "To", type: "date" },
          ]}
        />
        <SimpleTable
          rows={result.data}
          rowKey={(r) => r.id}
          empty="No commissions found."
          columns={[
            { header: "Commission", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { header: "Order", cell: (r) => <span className="font-mono text-xs">{r.orderNumber}</span> },
            { header: "Referral code", cell: (r) => <span className="font-mono text-xs">{r.referralCode ?? "—"}</span> },
            { header: "Customer", cell: (r) => r.customerName },
            { header: "Product", cell: (r) => `${r.productName} × ${r.quantity}` },
            { header: "Category", cell: (r) => r.categoryName ?? "—" },
            { header: "Product amount", cell: (r) => money(r.productAmount) },
            { header: "%", cell: (r) => pct(r.percentage) },
            { header: "Commission", cell: (r) => <strong>{money(r.amount)}</strong> },
            {
              header: "Status",
              cell: (r) => (
                <div className="flex flex-col gap-1">
                  <StatusBadge status={r.status} />
                  {r.reversalReason && r.status === "reversed" && (
                    <span className="max-w-[12rem] truncate text-[11px] text-neutral-500" title={r.reversalReason}>
                      {r.reversalReason}
                    </span>
                  )}
                </div>
              ),
            },
            { header: "Order date", cell: (r) => dateOnly(r.createdAt) },
            { header: "Eligible on", cell: (r) => dateOnly(r.eligibleAt) },
            { header: "Approved", cell: (r) => dateOnly(r.approvedAt) },
            { header: "Paid", cell: (r) => dateOnly(r.paidAt) },
          ]}
        />
        <LinkPager basePath="/agent/commissions" params={filters} page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} />
      </Panel>
    </>
  );
}
