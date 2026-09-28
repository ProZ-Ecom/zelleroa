import { agentService } from "@/features/agents/services/agent.service";
import { pageParam, pickParams, requireAgentPage } from "@/features/agents/lib/page-context";
import {
  COMMISSION_STATUS_OPTIONS,
  FilterForm,
  PageHeader,
  LinkPager,
  ORDER_STATUS_OPTIONS,
  Panel,
  SimpleTable,
  StatusBadge,
  dateOnly,
  money,
  pct,
} from "@/features/agents/components/shared";

export const metadata = { title: "My Orders" };

export default async function AgentOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { agentId } = await requireAgentPage("/agent/orders");
  const sp = await searchParams;
  const filters = pickParams(sp, ["order", "referralCode", "customer", "orderStatus", "commissionStatus", "dateFrom", "dateTo"]);
  const page = pageParam(sp);

  const result = await agentService.listOrderLines({ ...filters, page, limit: 20 }, { agentId });

  return (
    <>
      <PageHeader title="My Orders" description="Every product ordered by your customers, with the commission it earns." />

      <Panel>
        <FilterForm
          action="/agent/orders"
          values={filters}
          fields={[
            { name: "order", label: "Order" },
            { name: "referralCode", label: "Referral code" },
            { name: "customer", label: "Customer" },
            { name: "orderStatus", label: "Order status", type: "select", options: ORDER_STATUS_OPTIONS },
            { name: "commissionStatus", label: "Commission status", type: "select", options: COMMISSION_STATUS_OPTIONS },
            { name: "dateFrom", label: "From", type: "date" },
            { name: "dateTo", label: "To", type: "date" },
          ]}
        />
        <SimpleTable
          rows={result.data}
          rowKey={(r) => r.id}
          empty="No orders found."
          columns={[
            { header: "Order", cell: (r) => <span className="font-mono text-xs">{r.orderNumber}</span> },
            { header: "Referral code", cell: (r) => <span className="font-mono text-xs">{r.referralCode ?? "—"}</span> },
            { header: "Customer", cell: (r) => r.customerName },
            { header: "Order date", cell: (r) => dateOnly(r.orderDate) },
            { header: "Product", cell: (r) => `${r.productName} × ${r.quantity}` },
            { header: "Product amount", cell: (r) => money(r.productAmount) },
            { header: "Order status", cell: (r) => <StatusBadge status={r.orderStatus} /> },
            { header: "Comm. %", cell: (r) => pct(r.commissionPercentage) },
            { header: "Commission", cell: (r) => <strong>{money(r.commissionAmount)}</strong> },
            { header: "Comm. status", cell: (r) => <StatusBadge status={r.commissionStatus} /> },
          ]}
        />
        <LinkPager basePath="/agent/orders" params={filters} page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} />
      </Panel>
    </>
  );
}
