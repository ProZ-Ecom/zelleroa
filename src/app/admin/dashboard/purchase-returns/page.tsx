"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/common/export-button";
import { exportDataToCsv } from "@/lib/export-csv";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { usePurchaseReturns } from "@/features/purchases/hooks";
import {
  PurchaseReturnStatusBadge,
  purchaseReturnStatusOptions,
} from "@/features/purchases/components/PurchaseReturnBadges";
import type { PurchaseReturnResponse, PurchaseReturnStatus } from "@/features/purchases/types";

export default function PurchaseReturnsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PurchaseReturnStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, error, refetch } = usePurchaseReturns({
    page,
    pageSize,
    search: search || undefined,
    status: status || undefined,
  });
  const returns = data?.data ?? [];

  const columns: ColumnDef<PurchaseReturnResponse>[] = [
    {
      accessorKey: "returnNumber",
      header: "Return No.",
      cell: ({ row }) => (
        <Link
          href={`/admin/dashboard/purchase-returns/${row.original.id}`}
          className="font-semibold text-[var(--color-primary-600)] hover:underline"
        >
          {row.original.returnNumber}
        </Link>
      ),
    },
    {
      id: "vendor",
      header: "Vendor",
      cell: ({ row }) => <span className="text-sm">{row.original.vendor.name}</span>,
    },
    {
      id: "po",
      header: "Against",
      cell: ({ row }) => (
        <Link
          href={`/admin/dashboard/purchase-orders/${row.original.purchaseOrder.id}`}
          className="text-sm text-[var(--color-primary-600)] hover:underline"
        >
          {row.original.purchaseOrder.poNumber}
        </Link>
      ),
    },
    {
      accessorKey: "itemCount",
      header: "Items",
      cell: ({ row }) => <span className="text-sm">{row.original.itemCount}</span>,
    },
    {
      accessorKey: "totalAmount",
      header: "Debit note value",
      cell: ({ row }) => (
        <span className="text-sm font-medium">₹{row.original.totalAmount.toFixed(2)}</span>
      ),
    },
    {
      accessorKey: "debitNoteNumber",
      header: "Debit note no.",
      cell: ({ row }) => <span className="text-sm">{row.original.debitNoteNumber ?? "—"}</span>,
    },
    {
      accessorKey: "returnDate",
      header: "Return date",
      cell: ({ row }) => <span className="text-sm">{row.original.returnDate ?? "—"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <PurchaseReturnStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/admin/dashboard/purchase-returns/${row.original.id}`)}
          >
            <Eye className="h-4 w-4 text-[var(--color-neutral-500)]" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading && !data) return <AdminTableSkeleton />;
  if (error) return <ErrorState message="Failed to load purchase returns" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Purchase Returns"
        description="Goods sent back to a vendor, and the debit note owed for them."
      />

      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">
          <div className="flex-shrink-0 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-64 lg:w-72 shrink-0">
                <SearchInput
                  placeholder="Search return, debit note, PO or vendor..."
                  defaultValue={search}
                  onSearch={(val) => {
                    setSearch(val);
                    setPage(1);
                  }}
                />
              </div>
              <div className="w-44 lg:w-48 shrink-0">
                <Select
                  value={status}
                  onValueChange={(val) => {
                    setStatus(val as PurchaseReturnStatus | "");
                    setPage(1);
                  }}
                  options={[{ value: "", label: "All statuses" }, ...purchaseReturnStatusOptions]}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 xl:gap-3 shrink-0">
              <ExportButton
                onClick={() =>
                  exportDataToCsv(returns, "purchase-returns", [
                    { header: "Return No.", accessor: (r) => r.returnNumber },
                    { header: "Vendor", accessor: (r) => r.vendor?.name || "—" },
                    { header: "Purchase Order", accessor: (r) => r.purchaseOrder?.poNumber || "—" },
                    { header: "Items", accessor: (r) => r.itemCount },
                    { header: "Value", accessor: (r) => `₹${r.totalAmount.toFixed(2)}` },
                    { header: "Debit Note", accessor: (r) => r.debitNoteNumber || "—" },
                    { header: "Return Date", accessor: (r) => r.returnDate || "—" },
                    { header: "Status", accessor: (r) => r.status },
                  ])
                }
                disabled={!returns.length}
                className="px-4 shrink-0"
              />
              <Button
                variant="outline"
                onClick={() => router.push("/admin/dashboard/purchase-orders")}
                className="h-11 rounded-xl px-4 text-sm font-semibold whitespace-nowrap shrink-0"
              >
                Return from a purchase
              </Button>
            </div>
          </div>

          <div className="mt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <DataTable
              columns={columns}
              data={returns}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 30, 50]}
              page={data?.meta?.page ?? page}
              totalPages={data?.meta?.totalPages ?? 1}
              totalItems={data?.meta?.total ?? returns.length}
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
