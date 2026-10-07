import { agentService } from "@/features/agents/services/agent.service";
import { pageParam, pickParams, requireAgentPage } from "@/features/agents/lib/page-context";
import {
  COMMISSION_STATUS_OPTIONS,
  FilterForm,
  PageHeader,
  LinkPager,
  ORDER_STATUS_OPTIONS,
  ORDER_SOURCE_OPTIONS,
  OrderSourceCell,
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
  const filters = pickParams(sp, ["order", "referralCode", "customer", "view", "orderSource", "orderStatus", "commissionStatus", "dateFrom", "dateTo"]);
  const page = pageParam(sp);
  const view = filters.view === "own" ? "own" : "customers";
  filters.view = view;

  const result = await agentService.listOrderLines({ ...filters, page, limit: 20 }, { agentId });

  return (
    <>
      <PageHeader title={view === "own" ? "Agent Own Orders" : "Customer Orders"}
        description={view === "own" ? "Orders you placed for yourself, with the commission they earn." : "Orders of customers currently assigned to you (placed by the customer or by you), with the commission they earn."}
      />
      <div className="flex gap-2 text-sm">
        {[
          { v: "customers", label: "Customer Orders" },
          { v: "own", label: "Agent Own Orders" },
        ].map((t) => (
          <a
            key={t.v}
            href={`/agent/orders?view=${t.v}`}
            className={`rounded-full border px-4 py-1.5 font-medium ${view === t.v ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700"}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <Panel>
        <FilterForm
          action="/agent/orders"
          values={filters}
          fields={[
            { name: "order", label: "Order" },
            { name: "referralCode", label: "Referral code" },
            { name: "customer", label: "Customer" },
            { name: "orderSource", label: "Order source", type: "select", options: ORDER_SOURCE_OPTIONS },
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
            { header: "Order source", cell: (r) => <OrderSourceCell source={r.orderSource} orderedBy={r.orderedByName} /> },
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
