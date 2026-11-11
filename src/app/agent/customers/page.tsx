"use client";

import { Suspense, useState } from "react";
import type { AgentCustomerRow } from "@/features/agents/services/agent.service";
import { errorMessage, useAdminList } from "@/features/agents/hooks/use-admin-agents";
import { PageHeader, Panel, SimpleTable, StatusBadge, dateOnly, money, TableSkeleton } from "@/features/agents/components/shared";
import { ButtonPager } from "@/features/agents/components/AdminPagination";
import { AdminFilterBar, type FilterField } from "@/features/agents/components/admin/AdminFilterBar";

function AgentCustomersContent() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const params = { ...filters, page, limit: pageSize };
  const { data, isLoading, error } = useAdminList<AgentCustomerRow>("agent-customers", "/api/agent/customers", params);

  const fields: FilterField[] = [
    { name: "search", label: "Search name, ID, email or phone", type: "text" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
  ];

  return (
    <>
      <PageHeader
        title="My Customers"
        description="Customers currently assigned to you. If an admin transfers a customer to another Sales Partner, they leave this list and you can no longer see or order for them."
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
                {
                  header: "Customer ID",
                  cell: (r) => (
                    <span className="font-mono text-xs text-neutral-800" title={r.customerCode || r.id}>
                      {r.customerCode || r.id || "—"}
                    </span>
                  ),
                },
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

export default function AgentCustomersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <AgentCustomersContent />
    </Suspense>
  );
}
