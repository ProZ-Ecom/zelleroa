"use client";

import { useState } from "react";
import { PageContainer } from "@/components/admin/PageContainer";
import type { CommissionReportRow } from "@/features/agents/services/commission-report.service";
import { errorMessage, useAdminObject } from "@/features/agents/hooks/use-admin-agents";
import { AdminFilterBar, type FilterField } from "@/features/agents/components/admin/AdminFilterBar";
import { MetricCard, Panel, SimpleTable, TableSkeleton, money } from "@/features/agents/components/shared";

interface Report {
  data: CommissionReportRow[];
  totals: Omit<CommissionReportRow, "agentId" | "agentName" | "agentCode">;
}

const FIELDS: FilterField[] = [
  { name: "agent", label: "Agent", type: "agent" },
  { name: "dateFrom", label: "From", type: "date" },
  { name: "dateTo", label: "To", type: "date" },
];

export default function CommissionReportsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const { data, isLoading, error } = useAdminObject<Report>("report", `/api/admin/commission-reports${query ? `?${query}` : ""}`);

  return (
    <PageContainer
      title="Commission Reports"
      description="Orders and sales come from orders placed in the range; commission figures from commissions created in the range."
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Commission reports" }]}
    >
      <div className="flex flex-col gap-5">
        <Panel>
          <AdminFilterBar fields={FIELDS} values={filters} onApply={setFilters} />
        </Panel>

        {error ? (
          <p className="py-10 text-center text-sm text-red-600">{errorMessage(error)}</p>
        ) : isLoading || !data ? (
          <Panel>
            <TableSkeleton />
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard label="Orders" value={data.totals.orders} />
              <MetricCard label="Sales" value={money(data.totals.sales)} hint="Product value, excl. delivery" />
              <MetricCard label="Total earned" value={money(data.totals.totalEarned)} />
              <MetricCard label="Paid out" value={money(data.totals.paid)} tone="good" />
              <MetricCard label="Pending" value={money(data.totals.pending)} tone="warn" />
              <MetricCard label="Approved / in payout" value={money(data.totals.approved)} tone="good" />
              <MetricCard label="Cancelled / reversed" value={money(data.totals.cancelledOrReversed)} />
              <MetricCard label="Clawback due" value={money(data.totals.clawbackDue)} tone={data.totals.clawbackDue > 0 ? "warn" : "default"} hint="Already paid, later reversed" />
            </div>
            <Panel title="By agent">
              <SimpleTable
                rows={data.data}
                rowKey={(r) => r.agentId}
                empty="No agent activity in this range."
                columns={[
                  { header: "Agent", cell: (r) => `${r.agentName}${r.agentCode ? ` (${r.agentCode})` : ""}` },
                  { header: "Orders", cell: (r) => r.orders },
                  { header: "Sales", cell: (r) => money(r.sales) },
                  { header: "Pending", cell: (r) => money(r.pending) },
                  { header: "Approved", cell: (r) => money(r.approved) },
                  { header: "Paid", cell: (r) => money(r.paid) },
                  { header: "Cancelled / reversed", cell: (r) => money(r.cancelledOrReversed) },
                  { header: "Clawback due", cell: (r) => money(r.clawbackDue) },
                  { header: "Total earned", cell: (r) => <strong>{money(r.totalEarned)}</strong> },
                ]}
              />
            </Panel>
          </>
        )}
      </div>
    </PageContainer>
  );
}
