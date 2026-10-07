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
  const filters = pickParams(sp, ["search", "status"]);
  const page = pageParam(sp);

  const result = await agentService.listCustomers(agentId, { search: filters.search, status: filters.status, page, limit: 20 });

  return (
    <>
      <PageHeader title="My Customers" description="Customers currently assigned to you. If an admin transfers a customer to another Sales Partner, they leave this list and you can no longer see or order for them." />

      <Panel>
        <FilterForm
          action="/agent/customers"
          values={filters}
          fields={[
            { name: "search", label: "Search name, ID, email or phone" },
            { name: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
          ]}
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
                </div>
              ),
            },
            { header: "Customer ID", cell: (r) => <span className="font-mono text-xs">{r.customerCode ?? "—"}</span> },
            { header: "Mobile", cell: (r) => r.phone ?? "—" },
            { header: "Email", cell: (r) => r.email ?? "—" },
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
