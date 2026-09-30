"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, Power } from "lucide-react";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { SearchInput } from "@/components/ui/search-input";
import { useVendors, useVendorMutations } from "@/features/purchases/hooks";
import { VendorForm } from "@/features/purchases/components/VendorForm";
import type { VendorResponse } from "@/features/purchases/types";

export default function VendorsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<VendorResponse | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<VendorResponse | null>(null);

  const { data, isLoading, error, refetch } = useVendors({
    page,
    pageSize,
    search: search || undefined,
  });
  const { create, update, remove } = useVendorMutations();
  const vendors = data?.data ?? [];

  const columns: ColumnDef<VendorResponse>[] = [
    {
      accessorKey: "name",
      header: "Vendor",
      cell: ({ row }) => (
        <div>
          <Link
            href={`/admin/dashboard/vendors/${row.original.id}`}
            className="font-semibold text-[var(--color-neutral-900)] hover:underline"
          >
            {row.original.name}
          </Link>
          <p className="text-xs text-[var(--color-neutral-500)]">{row.original.code}</p>
        </div>
      ),
    },
    {
      accessorKey: "contactPerson",
      header: "Contact",
      cell: ({ row }) => (
        <div className="text-sm text-[var(--color-neutral-700)]">
          <p>{row.original.contactPerson || "—"}</p>
          <p className="text-xs text-[var(--color-neutral-500)]">
            {[row.original.phone, row.original.email].filter(Boolean).join(" · ")}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "gstin",
      header: "GSTIN",
      cell: ({ row }) => <span className="text-sm">{row.original.gstin || "—"}</span>,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "outline"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1.5">
          <Link href={`/admin/dashboard/vendors/${row.original.id}`}>
            <Button variant="ghost" size="icon" title="View vendor">
              <Eye className="h-4 w-4 text-[var(--color-neutral-500)]" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            title={row.original.isActive ? "Disable vendor" : "Enable vendor"}
            onClick={() => setToggling(row.original)}
          >
            <Power
              className={`h-4 w-4 ${row.original.isActive ? "text-[var(--color-neutral-500)]" : "text-green-600"}`}
            />
          </Button>
          <Button variant="ghost" size="icon" title="Edit vendor" onClick={() => setEditing(row.original)}>
            <Pencil className="h-4 w-4 text-[var(--color-neutral-500)]" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.original.id)}>
            <Trash2 className="h-4 w-4 text-[var(--color-error-600)]" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading && !data) return <AdminTableSkeleton />;
  if (error) return <ErrorState message="Failed to load vendors" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader title="Vendors" description="Suppliers you buy stock from." />

      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">
          <div className="flex-shrink-0 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SearchInput
              placeholder="Search vendors..."
              defaultValue={search}
              onSearch={(val) => {
                setSearch(val);
                setPage(1);
              }}
              className="w-full max-w-md"
            />
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="h-11 rounded-xl bg-[var(--color-secondary-600)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-secondary-700)]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Vendor
            </Button>
          </div>

          <div className="mt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <DataTable
              columns={columns}
              data={vendors}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 30, 50]}
              page={data?.meta?.page ?? page}
              totalPages={data?.meta?.totalPages ?? 1}
              totalItems={data?.meta?.total ?? vendors.length}
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

      <FormModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Vendor"
        description="Create a new supplier"
        size="lg"
      >
        <VendorForm
          submitLabel="Create Vendor"
          isLoading={create.isPending}
          onSubmit={async (form) => {
            await create.mutateAsync({ ...form });
            setIsCreateOpen(false);
          }}
        />
      </FormModal>

      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Update Vendor"
        description="Update supplier details"
        size="lg"
      >
        {editing && (
          <VendorForm
            initial={editing}
            submitLabel="Update Vendor"
            isLoading={update.isPending}
            onSubmit={async (form) => {
              await update.mutateAsync({ uuid: editing.id, data: { ...form } });
              setEditing(null);
            }}
          />
        )}
      </FormModal>

      <ConfirmDialog
        open={!!toggling}
        onClose={() => setToggling(null)}
        onConfirm={() => {
          if (toggling)
            update.mutate(
              { uuid: toggling.id, data: { isActive: !toggling.isActive } },
              { onSuccess: () => setToggling(null) }
            );
        }}
        title={toggling?.isActive ? "Disable Vendor" : "Enable Vendor"}
        description={
          toggling?.isActive
            ? `${toggling.name} will no longer be selectable for new purchases. Past purchases are kept.`
            : `${toggling?.name ?? "This vendor"} will be available for new purchases again.`
        }
        confirmText={toggling?.isActive ? "Disable" : "Enable"}
        variant={toggling?.isActive ? "destructive" : "default"}
        isLoading={update.isPending}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        title="Delete Vendor"
        description="Are you sure you want to delete this vendor? Past purchase orders keep their history."
        confirmText="Delete"
        variant="destructive"
        isLoading={remove.isPending}
      />
    </div>
  );
}
