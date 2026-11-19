"use client";

import { useState } from "react";
import type { PayoutRow } from "@/features/agents/types";
import { errorMessage, useAdminList } from "@/features/agents/hooks/use-admin-agents";
import {
  PAYOUT_STATUS_OPTIONS,
  Panel,
  SimpleTable,
  StatusBadge,
  dateOnly,
  money,
  TableSkeleton,
} from "@/features/agents/components/shared";
import { ButtonPager } from "@/features/agents/components/AdminPagination";
import { AdminFilterBar, type FilterField } from "@/features/agents/components/admin/AdminFilterBar";

export function AgentPayoutHistorySection() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const params = { ...filters, page, limit: pageSize };
  const { data, isLoading, error } = useAdminList<PayoutRow>("agent-payouts", "/api/agent/payouts", params);

  const fields: FilterField[] = [
    { name: "status", label: "Status", type: "select", options: PAYOUT_STATUS_OPTIONS },
    { name: "dateFrom", label: "From", type: "date" },
    { name: "dateTo", label: "To", type: "date" },
  ];

  return (
    <Panel title="Payout history">
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
  );
}

