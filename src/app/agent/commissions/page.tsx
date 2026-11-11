"use client";

import { Suspense, useState } from "react";
import type { CommissionRow } from "@/features/agents/types";
import { errorMessage, useAdminList } from "@/features/agents/hooks/use-admin-agents";
import {
  COMMISSION_STATUS_OPTIONS,
  ORDER_STATUS_OPTIONS,
  PageHeader,
  Panel,
  SimpleTable,
  StatusBadge,
  dateOnly,
  money,
  pct,
  TableSkeleton,
} from "@/features/agents/components/shared";
import { ButtonPager } from "@/features/agents/components/AdminPagination";
import { AdminFilterBar, type FilterField } from "@/features/agents/components/admin/AdminFilterBar";

function AgentCommissionsContent() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const params = { ...filters, page, limit: pageSize };
  const { data, isLoading, error } = useAdminList<CommissionRow>("agent-commissions", "/api/agent/commissions", params);

  const fields: FilterField[] = [
    { name: "order", label: "Order", type: "text" },
    { name: "referralCode", label: "Referral code", type: "text" },
    { name: "customer", label: "Customer", type: "text" },
    { name: "status", label: "Commission status", type: "select", options: COMMISSION_STATUS_OPTIONS },
    { name: "orderStatus", label: "Order status", type: "select", options: ORDER_STATUS_OPTIONS },
    { name: "dateFrom", label: "From", type: "date" },
    { name: "dateTo", label: "To", type: "date" },
  ];

  return (
    <>
      <PageHeader
        title="My Commissions"
        description="Commission is calculated on the product amount only (delivery excluded). It becomes payable once the return period is over. Cancelled or returned orders earn nothing."
      />

      <Panel>
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
            <ButtonPager
              page={page}
              totalPages={data?.meta.totalPages ?? 1}
              total={data?.meta.total ?? 0}
              onPage={setPage}
              pageSize={pageSize}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </>
        )}
      </Panel>
    </>
  );
}

export default function AgentCommissionsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <AgentCommissionsContent />
    </Suspense>
  );
}
