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
import { ExportButton } from "@/components/common/export-button";
import { exportDataToCsv } from "@/lib/export-csv";
import { Plus, Pencil, Trash2, FolderTree, Link2, Tag } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import type { ColumnDef } from "@tanstack/react-table";
import { type AdminHeaderMenuItemResponse, MAX_HEADER_MENU_ITEMS } from "@/features/header-menu/types";

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
  const totalItems = data?.meta?.total ?? items.length;
  const isLimitReached = totalItems >= MAX_HEADER_MENU_ITEMS;

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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-secondary-50)] px-3 py-1 text-xs font-medium text-[var(--color-primary-600)]">
                <FolderTree className="h-3.5 w-3.5" />
                {count > 1 ? `${count} Categories` : "Category"}
              </span>
            )}
            {row.original.tags.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-secondary-50)] px-3 py-1 text-xs font-medium text-[var(--color-primary-600)]">
                <Tag className="h-3.5 w-3.5" />
                {row.original.tags.length > 1 ? `${row.original.tags.length} Tags` : "Tag"}
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
            : row.original.tags.length > 0
              ? row.original.tags.map((t) => t.name).join(", ")
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
          <div className="flex-shrink-0 mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Header Menu Limit Indicator */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold ${
                  isLimitReached
                    ? "bg-amber-50 text-amber-900 border border-amber-300"
                    : "bg-blue-50 text-theme-primary border border-blue-200"
                }`}
              >
                <span>{totalItems} / {MAX_HEADER_MENU_ITEMS} Items</span>
                {isLimitReached ? (
                  <span className="font-bold text-amber-700">(Max Limit Reached)</span>
                ) : (
                  <span className="text-slate-500 font-normal">({MAX_HEADER_MENU_ITEMS - totalItems} remaining)</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ExportButton
                onClick={() =>
                  exportDataToCsv(
                    items,
                    "header-menu",
                    [
                      { header: "Label", accessor: (item) => item.label },
                      {
                        header: "Type",
                        accessor: (item) =>
                          item.categories.length > 0
                            ? "Category"
                            : item.tags.length > 0
                              ? "Tag"
                              : item.link
                                ? "Link"
                                : "—",
                      },
                      {
                        header: "Target",
                        accessor: (item) =>
                          item.categories.length > 0
                            ? item.categories.map((c) => c.name).join(", ")
                            : item.tags.length > 0
                              ? item.tags.map((t) => t.name).join(", ")
                              : item.link || "—",
                      },
                      { header: "Audience", accessor: (item) => item.gender || "All" },
                      { header: "Sort Order", accessor: (item) => item.sortOrder },
                      { header: "Status", accessor: (item) => (item.isActive ? "Active" : "Inactive") },
                    ]
                  )
                }
                disabled={!items.length}
              />

              <Button
                type="button"
                disabled={isLimitReached}
                onClick={() => {
                  if (isLimitReached) {
                    toast.error(`A maximum of ${MAX_HEADER_MENU_ITEMS} header menu items can exist. Please delete or modify an existing item.`);
                    return;
                  }
                  setIsCreateOpen(true);
                }}
                className={`h-11 rounded-xl transition-all px-5 text-sm font-semibold shadow-xs ${
                  isLimitReached
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed opacity-75 shadow-none"
                    : "bg-theme-primary hover:bg-theme-primary-hover text-white transition-colors"
                }`}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Menu Item
              </Button>
            </div>
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
        description={`Add a new item to the storefront header menu (${totalItems}/${MAX_HEADER_MENU_ITEMS})`}
      >
        <HeaderMenuForm
          isLoading={createMutation.isPending}
          submitLabel="Create Menu Item"
          onSubmit={async (payload) => {
            try {
              await createMutation.mutateAsync({ ...payload });
              toast.success("Header menu item created successfully");
              setIsCreateOpen(false);
            } catch (err: any) {
              const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Failed to create header menu item";
              toast.error(msg);
            }
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
              tagIds: selectedItem.tags.map((t) => t.id),
              tags: selectedItem.tags,
              link: selectedItem.link,
              gender: selectedItem.gender,
              sortOrder: selectedItem.sortOrder,
              isActive: selectedItem.isActive,
            }}
            isLoading={updateMutation.isPending}
            submitLabel="Update Menu Item"
            onSubmit={async (payload) => {
              try {
                await updateMutation.mutateAsync({ uuid: selectedItem.id, data: { ...payload } });
                toast.success("Header menu item updated successfully");
                setIsEditOpen(false);
                setSelectedItem(null);
              } catch (err: any) {
                const msg =
                  err?.response?.data?.message ||
                  err?.message ||
                  "Failed to update header menu item";
                toast.error(msg);
              }
            }}
          />
        )}
      </FormModal>
    </div>
  );
}
