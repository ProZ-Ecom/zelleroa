"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AgentOrderLine } from "@/features/agents/services/agent.service";
import { errorMessage, useAdminList } from "@/features/agents/hooks/use-admin-agents";
import {
  COMMISSION_STATUS_OPTIONS,
  ORDER_STATUS_OPTIONS,
  ORDER_SOURCE_OPTIONS,
  OrderSourceCell,
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

function AgentOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view") === "own" ? "own" : "customers";

  const [view, setView] = useState<"customers" | "own">(initialView);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const v = searchParams.get("view") === "own" ? "own" : "customers";
    setView((prev) => {
      if (prev !== v) {
        setPage(1);
        return v;
      }
      return prev;
    });
  }, [searchParams]);

  const handleViewChange = (v: "customers" | "own") => {
    setView(v);
    setPage(1);
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", v);
    router.replace(`/agent/orders?${next.toString()}`);
  };

  const params = { ...filters, view, page, limit: pageSize };
  const { data, isLoading, error } = useAdminList<AgentOrderLine>("agent-orders", "/api/agent/orders", params);

  const fields: FilterField[] = [
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
    <>
      <PageHeader
        title={view === "own" ? "Agent Own Orders" : "Customer Orders"}
        description={
          view === "own"
            ? "Orders you placed for yourself, with the commission they earn."
            : "Orders of customers currently assigned to you (placed by the customer or by you), with the commission they earn."
        }
      />
      <div className="flex gap-2 text-sm">
        {[
          { v: "customers" as const, label: "Customer Orders" },
          { v: "own" as const, label: "Agent Own Orders" },
        ].map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => handleViewChange(t.v)}
            className={`rounded-full border px-4 py-1.5 font-medium transition-colors ${
              view === t.v
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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

export default function AgentOrdersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <AgentOrdersContent />
    </Suspense>
  );
}
