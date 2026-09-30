import { agentService } from "@/features/agents/services/agent.service";
import { pageParam, pickParams, requireAgentPage } from "@/features/agents/lib/page-context";
import { FilterForm, LinkPager, PageHeader, Panel, SimpleTable, StatusBadge, dateOnly, money } from "@/features/agents/components/shared";

export const metadata = { title: "My Customers" };

export default async function AgentCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { agentId } = await requireAgentPage("/agent/customers");
  const sp = await searchParams;
  const filters = pickParams(sp, ["search"]);
  const page = pageParam(sp);

  const result = await agentService.listCustomers(agentId, { search: filters.search, page, limit: 20 });

  return (
    <>
      <PageHeader title="My Customers" description="Customers who have ordered using your referral code. Only orders placed with your code count - a customer is never tied to you permanently." />

      <Panel>
        <FilterForm
          action="/agent/customers"
          values={filters}
          fields={[{ name: "search", label: "Search name, email or phone" }]}
        />
        <SimpleTable
          rows={result.data}
          rowKey={(r) => r.id}
          empty="No customers found."
          columns={[
            {
              header: "Customer",
              cell: (r) => (
                <div className="min-w-[10rem]">
                  <p className="font-medium text-neutral-900">{r.name}</p>
                  <p className="text-xs text-neutral-500">{r.contact ?? "—"}</p>
                </div>
              ),
            },
            { header: "Registered", cell: (r) => dateOnly(r.registeredAt) },
            { header: "Last order", cell: (r) => dateOnly(r.lastOrderAt) },
            { header: "Orders", cell: (r) => r.totalOrders },
            { header: "Sales", cell: (r) => money(r.totalSales) },
            { header: "Commission", cell: (r) => <strong>{money(r.commissionGenerated)}</strong> },
            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
        <LinkPager basePath="/agent/customers" params={filters} page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} />
      </Panel>
    </>
  );
}
