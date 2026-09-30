"use client";

import { useState } from "react";
import {
  useAdminHeaderMenuItems,
  useCreateHeaderMenuItem,
  useUpdateHeaderMenuItem,
  useDeleteHeaderMenuItem,
} from "@/features/header-menu/hooks";
import { HeaderMenuForm } from "@/features/header-menu/components";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { StatusToggle } from "@/components/admin/StatusToggle";
import { Plus, Pencil, Trash2, FolderTree, Link2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminHeaderMenuItemResponse } from "@/features/header-menu/types";

export default function AdminHeaderMenuPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deleteUuid, setDeleteUuid] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AdminHeaderMenuItemResponse | null>(null);

  const { data, isLoading, error, refetch } = useAdminHeaderMenuItems({ page, pageSize });

  const createMutation = useCreateHeaderMenuItem();
  const updateMutation = useUpdateHeaderMenuItem();
  const deleteMutation = useDeleteHeaderMenuItem();

  const items = data?.data ?? [];

  const columns: ColumnDef<AdminHeaderMenuItemResponse, unknown>[] = [
    {
      accessorKey: "label",
      header: "Label",
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-neutral-900)]">{row.original.label}</p>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => {
        const count = row.original.categories.length;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {count > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-secondary-50)] px-3 py-1 text-xs font-medium text-[var(--color-secondary-700)]">
                <FolderTree className="h-3.5 w-3.5" />
                {count > 1 ? `${count} Categories` : "Category"}
              </span>
            )}
            {row.original.link && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-neutral-100)] px-3 py-1 text-xs font-medium text-[var(--color-neutral-600)]">
                <Link2 className="h-3.5 w-3.5" />
                Link
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "target",
      header: "Target",
      cell: ({ row }) => (
        <span className="text-sm text-[var(--color-neutral-600)]">
          {row.original.categories.length > 0
            ? row.original.categories.map((c) => c.name).join(", ")
            : row.original.link}
        </span>
      ),
    },
    {
      id: "gender",
      header: "Audience",
      cell: ({ row }) =>
        row.original.gender ? (
          <span className="inline-flex items-center rounded-full bg-[var(--color-primary-50)] px-3 py-1 text-xs font-medium capitalize text-[var(--color-primary-700)]">
            {row.original.gender}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-neutral-400)]">All</span>
        ),
    },
    {
      accessorKey: "sortOrder",
      header: "Sort Order",
      cell: ({ row }) => (
        <span className="text-[var(--color-neutral-700)]">{row.original.sortOrder}</span>
      ),
    },
    {
      id: "isActive",
      header: "Active",
      cell: ({ row }) => (
        <StatusToggle
          id={0}
          isActive={row.original.isActive}
          onToggle={() =>
            updateMutation.mutate({
              uuid: row.original.id,
              data: { isActive: !row.original.isActive },
            })
          }
          disabled={updateMutation.isPending}
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedItem(row.original);
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4 text-[var(--color-neutral-500)]" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteUuid(row.original.id)}>
            <Trash2 className="h-4 w-4 text-[var(--color-error-600)]" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading && !data) {
    return <AdminTableSkeleton />;
  }
  if (error) return <ErrorState message="Failed to load header menu" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Header Menu"
        description="Curate the storefront's top navigation - pick categories or add custom links, in any order."
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">
          <div className="flex-shrink-0 mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-end">
            <Button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="h-11 rounded-xl bg-[var(--color-secondary-600)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-secondary-700)]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Menu Item
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
              emptyMessage="No header menu items yet. Add one to populate the storefront nav."
              className="bg-white"
            />
          </div>
        </div>
      </AdminContent>

      <ConfirmDialog
        open={!!deleteUuid}
        onClose={() => setDeleteUuid(null)}
        onConfirm={() => {
          if (deleteUuid) {
            deleteMutation.mutate(deleteUuid, {
              onSuccess: () => setDeleteUuid(null),
            });
          }
        }}
        title="Delete Menu Item"
        description="Are you sure you want to remove this item from the header menu? This does not delete the underlying category."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />

      <FormModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Menu Item"
        description="Add a new item to the storefront header menu"
      >
        <HeaderMenuForm
          isLoading={createMutation.isPending}
          submitLabel="Create Menu Item"
          onSubmit={async (payload) => {
            await createMutation.mutateAsync({ ...payload });
            setIsCreateOpen(false);
          }}
        />
      </FormModal>

      <FormModal
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedItem(null);
        }}
        title="Update Menu Item"
        description="Update the selected header menu item"
      >
        {selectedItem && (
          <HeaderMenuForm
            initialData={{
              label: selectedItem.label,
              categoryIds: selectedItem.categories.map((c) => c.id),
              categories: selectedItem.categories,
              link: selectedItem.link,
              gender: selectedItem.gender,
              sortOrder: selectedItem.sortOrder,
              isActive: selectedItem.isActive,
            }}
            isLoading={updateMutation.isPending}
            submitLabel="Update Menu Item"
            onSubmit={async (payload) => {
              await updateMutation.mutateAsync({ uuid: selectedItem.id, data: { ...payload } });
              setIsEditOpen(false);
              setSelectedItem(null);
            }}
          />
        )}
      </FormModal>
    </div>
  );
}
