"use client";

import { useState, useEffect } from "react";
import { toast } from "@/components/ui/Toast";
import { useGstRates } from "@/features/gst-rates/hooks/use-gst-rates";
import {
  useCreateGstRate,
  useUpdateGstRate,
  useDeleteGstRate,
} from "@/features/gst-rates/hooks/use-gst-rate-mutations";

import { DataTable } from "@/components/admin/data-table/DataTable";
import {
  AdminPageHeader,
  AdminContent,
} from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { SearchInput } from "@/components/ui/search-input";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminGstRateResponse } from "@/features/gst-rates/types";
import { GstRateForm } from "@/features/gst-rates/components/GstRateForm";

export default function AdminGstRatesPage() {
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedGst, setSelectedGst] =
    useState<AdminGstRateResponse | null>(null);

  const { data, isLoading, error, refetch } = useGstRates({
  page,
  pageSize,
  search: search || undefined,
});

  const createMutation = useCreateGstRate();
  const updateMutation = useUpdateGstRate();
  const deleteMutation = useDeleteGstRate();

  const gstRates = data?.data ?? [];

  const columns: ColumnDef<AdminGstRateResponse>[] = [
    {
      accessorKey: "name",
      header: "GST Name",
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-neutral-900)]">
          {row.original.name}
        </p>
      ),
    },
    {
      accessorKey: "cgstPercent",
      header: "CGST %",
      cell: ({ row }) => (
        <span className="text-[var(--color-neutral-700)]">
          {row.original.cgstPercent}%
        </span>
      ),
    },
    {
      accessorKey: "sgstPercent",
      header: "SGST %",
      cell: ({ row }) => (
        <span className="text-[var(--color-neutral-700)]">
          {row.original.sgstPercent}%
        </span>
      ),
    },
    {
      accessorKey: "igstPercent",
      header: "IGST %",
      cell: ({ row }) => (
        <span className="text-[var(--color-neutral-700)]">
          {row.original.igstPercent}%
        </span>
      ),
    },
    // {
    //   accessorKey: "createdAt",
    //   header: "Created Date",
    //   cell: ({ row }) => (
    //     <span className="text-[var(--color-neutral-700)]">
    //       {new Date(row.original.createdAt).toLocaleDateString("en-IN")}
    //     </span>
    //   ),
    // },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedGst(row.original);
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4 text-[var(--color-neutral-500)]" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteId(row.original.id)}
          >
            <Trash2 className="h-4 w-4 text-[var(--color-error-600)]" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading && !data) {
    return <AdminTableSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load GST rates"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="GST Rate Management"
        description="Manage GST rates for products."
      />

      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">
          <div className="flex-shrink-0 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SearchInput
              placeholder="Search GST rates..."
              defaultValue={search}
              onSearch={(val) => {
                setSearch(val);
                setPage(1);
              }}
              className="w-full max-w-md"
            />

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="h-11 rounded-xl bg-gradient-to-b from-[var(--color-primary-400)] to-[var(--color-primary-600)] shadow-[0_6px_16px_-6px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all px-5 text-sm font-semibold text-white hover:-translate-y-px hover:shadow-[0_10px_20px_-8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add GST Rate
            </Button>
          </div>

          <div className="mt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <DataTable
              columns={columns}
              data={gstRates}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 30, 50]}
              page={data?.meta?.page ?? page}
              totalPages={data?.meta?.totalPages ?? Math.max(1, Math.ceil((data?.meta?.total ?? gstRates.length) / pageSize))}
              totalItems={data?.meta?.total ?? gstRates.length}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
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
        title="Add GST Rate"
        description="Create a new GST rate"
      >
        <GstRateForm
          isLoading={createMutation.isPending}
          submitLabel="Create GST Rate"
          onSubmit={async (formData) => {
            try {
              await createMutation.mutateAsync(formData);
              toast.success("GST Rate created", `"${formData.name}" was added successfully.`);
              setIsCreateOpen(false);
            } catch (err: any) {
              toast.error("Failed to create GST rate", err?.message || "Please try again.");
            }
          }}
        />
      </FormModal>

      <FormModal
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedGst(null);
        }}
        title="Update GST Rate"
        description="Update the selected GST rate"
      >
        {selectedGst && (
          <GstRateForm
            initialData={{
              name: selectedGst.name,
              cgstPercent: selectedGst.cgstPercent,
              sgstPercent: selectedGst.sgstPercent,
              igstPercent: selectedGst.igstPercent,
            }}
            isEditing
            isLoading={updateMutation.isPending}
            submitLabel="Update GST Rate"
            onSubmit={async (formData) => {
              try {
                await updateMutation.mutateAsync({
                  uuid: selectedGst.id,
                  data: formData,
                });
                toast.success("GST Rate updated", `"${formData.name}" was saved successfully.`);
                setIsEditOpen(false);
                setSelectedGst(null);
                refetch();
              } catch (err: any) {
                toast.error("Failed to update GST rate", err?.message || "Please try again.");
              }
            }}
          />
        )}
      </FormModal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            try {
              await deleteMutation.mutateAsync(deleteId);
              toast.success("GST Rate deleted", "The GST rate was removed successfully.");
              setDeleteId(null);
            } catch (err: any) {
              toast.error("Failed to delete GST rate", err?.message || "Please try again.");
            }
          }
        }}
        title="Delete GST Rate"
        description="Are you sure you want to delete this GST rate? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}