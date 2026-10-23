"use client";

import { useState } from "react";
import { useAdminTags, useCreateTag, useUpdateTag, useDeleteTag } from "@/features/tags/hooks";
import { TagForm, TagProductsModal } from "@/features/tags/components";
import type { AdminTagResponse } from "@/features/tags/types";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { ExportButton } from "@/components/common/export-button";
import { exportDataToCsv } from "@/lib/export-csv";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import type { ColumnDef } from "@tanstack/react-table";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function AdminTagsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTag, setEditTag] = useState<AdminTagResponse | null>(null);
  const [productsTag, setProductsTag] = useState<AdminTagResponse | null>(null);

  const { data, isLoading, error, refetch } = useAdminTags({ page, pageSize });

  const createMutation = useCreateTag();
  const updateMutation = useUpdateTag();
  const deleteMutation = useDeleteTag();

  const items = data?.data ?? [];

  const columns: ColumnDef<AdminTagResponse, unknown>[] = [
    {
      accessorKey: "name",
      header: "Tag",
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-neutral-900)]">{row.original.name}</p>
      ),
    },
    {
      accessorKey: "slug",
      header: "Link",
      cell: ({ row }) => (
        <code className="text-xs text-[var(--color-neutral-600)]">
          /products?tag={row.original.slug}
        </code>
      ),
    },
    {
      id: "productCount",
      header: "Products",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setProductsTag(row.original)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-secondary-50)] px-3 py-1 text-xs font-medium text-[var(--color-primary-600)] hover:opacity-80"
        >
          <Package className="h-3.5 w-3.5" />
          {row.original.productCount} product{row.original.productCount === 1 ? "" : "s"}
        </button>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.original.isActive;
        return isActive ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-300">
            Inactive
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={() => setEditTag(row.original)}>
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
  if (error) return <ErrorState message="Failed to load tags" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Tags"
        description="Group products under tags like Summer Sale or New Arrivals, then pick a tag when adding a header menu item."
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">
          <div className="flex-shrink-0 mt-6 flex items-center justify-end gap-2">
            <ExportButton
              onClick={() =>
                exportDataToCsv(
                  items,
                  "tags",
                  [
                    { header: "Tag Name", accessor: (item) => item.name },
                    { header: "Slug", accessor: (item) => item.slug },
                    { header: "Link", accessor: (item) => `/products?tag=${item.slug}` },
                    {
                      header: "Products",
                      accessor: (item) =>
                        item.productNames ||
                        (item.products && item.products.length > 0
                          ? item.products.map((p) => p.name).join(", ")
                          : "—"),
                    },
                    { header: "Status", accessor: (item) => (item.isActive ? "Active" : "Inactive") },
                  ]
                )
              }
              disabled={!items.length}
            />

            <Button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="h-11 rounded-xl px-5 text-sm font-semibold shadow-xs bg-theme-primary hover:bg-theme-primary-hover text-white transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Tag
            </Button>
          </div>

          <div className="mt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <DataTable
              columns={columns}
              data={items}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 30, 50]}
              page={data?.meta?.page ?? page}
              totalPages={
                data?.meta?.totalPages ?? Math.max(1, Math.ceil((data?.meta?.total ?? items.length) / pageSize))
              }
              totalItems={data?.meta?.total ?? items.length}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              emptyMessage="No tags yet. Add one, then assign products to it."
              className="bg-white"
            />
          </div>
        </div>
      </AdminContent>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
          }
        }}
        title="Delete Tag"
        description="This removes the tag from every product and from any header menu item using it. The products themselves are not deleted."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />

      <FormModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Tag"
        description="Create a tag, then assign products to it."
      >
        <TagForm
          isLoading={createMutation.isPending}
          submitLabel="Create Tag"
          onSubmit={async (payload) => {
            try {
              await createMutation.mutateAsync(payload);
              toast.success("Tag created successfully");
              setIsCreateOpen(false);
            } catch (err) {
              toast.error(errorMessage(err, "Failed to create tag"));
            }
          }}
        />
      </FormModal>

      <FormModal
        open={!!editTag}
        onClose={() => setEditTag(null)}
        title="Update Tag"
        description="Renaming a tag also changes its link."
      >
        {editTag && (
          <TagForm
            initialData={{ name: editTag.name, isActive: editTag.isActive }}
            isLoading={updateMutation.isPending}
            submitLabel="Update Tag"
            onSubmit={async (payload) => {
              try {
                await updateMutation.mutateAsync({ id: editTag.id, data: payload });
                toast.success("Tag updated successfully");
                setEditTag(null);
              } catch (err) {
                toast.error(errorMessage(err, "Failed to update tag"));
              }
            }}
          />
        )}
      </FormModal>

      <TagProductsModal tag={productsTag} onClose={() => setProductsTag(null)} />
    </div>
  );
}
