"use client";

import { useState } from "react";
import type { AgentOrderLine } from "../../services/agent.service";
import { errorMessage, useAdminList } from "../../hooks/use-admin-agents";
import {
  ButtonPager,
  COMMISSION_STATUS_OPTIONS,
  ORDER_STATUS_OPTIONS,
  ORDER_SOURCE_OPTIONS,
  OrderSourceCell,
  Panel,
  SimpleTable,
  StatusBadge,
  dateOnly,
  money,
  pct, TableSkeleton } from "../shared";
import { AdminFilterBar, type FilterField } from "./AdminFilterBar";

export function AdminOrdersSection({ fixedAgent }: { fixedAgent?: string }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const params = { ...filters, ...(fixedAgent ? { agent: fixedAgent } : {}), page, limit: 20 };
  const { data, isLoading, error } = useAdminList<AgentOrderLine>("orders", "/api/admin/agent-orders", params);

  const fields: FilterField[] = [
    ...(fixedAgent ? [] : [{ name: "agent", label: "Sales Partner", type: "agent" as const }]),
    { name: "order", label: "Order", type: "text" },
    { name: "referralCode", label: "Referral code", type: "text" },
    { name: "customer", label: "Customer", type: "text" },
    { name: "orderSource", label: "Order source", type: "select", options: ORDER_SOURCE_OPTIONS },
    { name: "orderStatus", label: "Order status", type: "select", options: ORDER_STATUS_OPTIONS },
    { name: "commissionStatus", label: "Commission status", type: "select", options: COMMISSION_STATUS_OPTIONS },
    { name: "dateFrom", label: "From", type: "date" },
    { name: "dateTo", label: "To", type: "date" },
  ];

  return (
    <Panel title="Sales Partner orders & sales">
      <AdminFilterBar
        fields={fields}
        values={filters}
        onApply={(v) => {
          setFilters(v);
          setPage(1);
        }}
      />
      {error ? (
        <p className="px-5 py-10 text-center text-sm text-red-600">{errorMessage(error)}</p>
      ) : isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          <SimpleTable
            rows={data?.data ?? []}
            rowKey={(r) => r.id}
            empty="No Sales Partner orders match these filters."
            columns={[
              { header: "Order", cell: (r) => <span className="font-mono text-xs">{r.orderNumber}</span> },
              ...(fixedAgent ? [] : [{ header: "Sales Partner", cell: (r: AgentOrderLine) => `${r.agentName}${r.agentCode ? ` (${r.agentCode})` : ""}` }]),
              { header: "Referral code", cell: (r) => <span className="font-mono text-xs">{r.referralCode ?? "—"}</span> },
              { header: "Customer", cell: (r) => r.customerName },
              { header: "Order source", cell: (r) => <OrderSourceCell source={r.orderSource} orderedBy={r.orderedByName} /> },
              { header: "Date", cell: (r) => dateOnly(r.orderDate) },
              { header: "Product", cell: (r) => `${r.productName} × ${r.quantity}` },
              { header: "Product amount", cell: (r) => money(r.productAmount) },
              { header: "Order status", cell: (r) => <StatusBadge status={r.orderStatus} /> },
              { header: "%", cell: (r) => pct(r.commissionPercentage) },
              { header: "Commission", cell: (r) => <strong>{money(r.commissionAmount)}</strong> },
              { header: "Comm. status", cell: (r) => <StatusBadge status={r.commissionStatus} /> },
            ]}
          />
          <ButtonPager page={page} totalPages={data?.meta.totalPages ?? 1} total={data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}
