"use client";

import { useState } from "react";
import type { OwnPurchaseRow } from "../../services/agent.service";
import { errorMessage, useAdminList } from "../../hooks/use-admin-agents";
import { ButtonPager, ORDER_STATUS_OPTIONS, Panel, SimpleTable, StatusBadge, TableSkeleton, dateOnly, money } from "../shared";
import { AdminFilterBar, type FilterField } from "./AdminFilterBar";

/** Orders the Sales Partner bought for themselves. These never earn commission - referral orders live in their own tab. */
export function AdminOwnPurchasesSection({ agentId }: { agentId: string }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAdminList<OwnPurchaseRow>("own-purchases", `/api/admin/agents/${agentId}/purchases`, { ...filters, page, limit: 20 });

  const fields: FilterField[] = [
    { name: "orderStatus", label: "Order status", type: "select", options: ORDER_STATUS_OPTIONS },
    { name: "dateFrom", label: "From", type: "date" },
    { name: "dateTo", label: "To", type: "date" },
  ];
  const totalSpend = data?.meta.totalSpend;

  return (
    <Panel title="Own purchases (no commission)">
      <AdminFilterBar
        fields={fields}
        values={filters}
        onApply={(v) => {
          setFilters(v);
          setPage(1);
        }}
      />
      {!error && !isLoading && (
        <p className="px-5 pb-3 text-sm text-gray-600">
          {data?.meta.total ?? 0} orders · Total spend <strong>{money(totalSpend ?? 0)}</strong>
        </p>
      )}
      {error ? (
        <p className="px-5 py-10 text-center text-sm text-red-600">{errorMessage(error)}</p>
      ) : isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          <SimpleTable
            rows={data?.data ?? []}
            rowKey={(r) => r.id}
            empty="This Sales Partner has not purchased anything for themselves."
            columns={[
              {
                header: "Order",
                cell: (r) => <span className="font-mono text-xs">{r.orderNumber}</span>,
              },
              { header: "Date", cell: (r) => dateOnly(r.orderDate) },
              {
                header: "Items",
                cell: (r) => (
                  <ul className="space-y-0.5 text-xs">
                    {r.items.map((i, idx) => (
                      <li key={idx}>
                        {i.productName} × {i.quantity} <span className="text-gray-500">({money(i.amount)})</span>
                      </li>
                    ))}
                  </ul>
                ),
              },
              { header: "Qty", cell: (r) => r.itemCount },
              { header: "Subtotal", cell: (r) => money(r.subtotal) },
              { header: "Total", cell: (r) => <strong>{money(r.total)}</strong> },
              { header: "Order status", cell: (r) => <StatusBadge status={r.orderStatus} /> },
              { header: "Payment", cell: (r) => <StatusBadge status={r.paymentStatus} /> },
            ]}
          />
          <ButtonPager page={page} totalPages={data?.meta.totalPages ?? 1} total={data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}
