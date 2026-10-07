"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Eye } from "lucide-react";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { usePurchaseOrders } from "@/features/purchases/hooks";
import {
  PurchaseStatusBadge,
  purchaseStatusOptions,
} from "@/features/purchases/components/PurchaseStatusBadge";
import type { PurchaseOrderResponse, PurchaseStatus } from "@/features/purchases/types";

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PurchaseStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, error, refetch } = usePurchaseOrders({
    page,
    pageSize,
    search: search || undefined,
    status: status || undefined,
  });
  const orders = data?.data ?? [];

  const columns: ColumnDef<PurchaseOrderResponse>[] = [
    {
      accessorKey: "poNumber",
      header: "PO Number",
      cell: ({ row }) => (
        <Link
          href={`/admin/dashboard/purchase-orders/${row.original.id}`}
          className="font-semibold text-[var(--color-primary-600)] hover:underline"
        >
          {row.original.poNumber}
        </Link>
      ),
    },
    {
      id: "vendor",
      header: "Vendor",
      cell: ({ row }) => <span className="text-sm">{row.original.vendor.name}</span>,
    },
    {
      accessorKey: "itemCount",
      header: "Items",
      cell: ({ row }) => <span className="text-sm">{row.original.itemCount}</span>,
    },
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: ({ row }) => (
        <span className="text-sm font-medium">₹{row.original.totalAmount.toFixed(2)}</span>
      ),
    },
    {
      accessorKey: "invoiceNumber",
      header: "Invoice",
      cell: ({ row }) => <span className="text-sm">{row.original.invoiceNumber ?? "—"}</span>,
    },
    {
      accessorKey: "purchaseDate",
      header: "Purchase date",
      cell: ({ row }) => <span className="text-sm">{row.original.purchaseDate ?? "—"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <PurchaseStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm">{new Date(row.original.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/admin/dashboard/purchase-orders/${row.original.id}`)}
          >
            <Eye className="h-4 w-4 text-[var(--color-neutral-500)]" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading && !data) return <AdminTableSkeleton />;
  if (error) return <ErrorState message="Failed to load purchase orders" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Purchase Orders"
        description="Raise, approve and receive stock from vendors."
      />

      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">
          <div className="flex-shrink-0 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full flex-col gap-3 md:flex-row md:items-center">
              <SearchInput
                placeholder="Search PO number or vendor..."
                defaultValue={search}
                onSearch={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                className="w-full max-w-md"
              />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as PurchaseStatus | "");
                  setPage(1);
                }}
                className="h-11 rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-secondary-600"
              >
                <option value="">All statuses</option>
                {purchaseStatusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/admin/dashboard/purchase-orders/new")}
              className="h-11 rounded-xl px-5 text-sm font-semibold"
            >
              New Purchase Order (draft)
            </Button>
            <Button
              onClick={() => router.push("/admin/dashboard/purchase-orders/confirm")}
              className="h-11 rounded-xl bg-[var(--color-primary-500)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-600)]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Purchase
            </Button>
            </div>
          </div>

          <div className="mt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <DataTable
              columns={columns}
              data={orders}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 30, 50]}
              page={data?.meta?.page ?? page}
              totalPages={data?.meta?.totalPages ?? 1}
              totalItems={data?.meta?.total ?? orders.length}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              className="bg-white"
            />
          </div>
        </div>
      </AdminContent>
    </div>
  );
}
