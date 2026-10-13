"use client";

import React, { useState, useMemo } from "react";
import { FormModal } from "@/components/common/FormModal";
import { CategoryForm } from "@/features/categories/components/CategoryForm";
import Image from "next/image";
import { toast } from "@/components/ui/Toast";
import {
  useCategories,
  useDeleteCategory,
  useCreateCategory,
  useUpdateCategory,
} from "@/features/categories/hooks";
import { getImageUrl } from "@/lib/utils";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchInput } from "@/components/ui/search-input";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { CategoryListItem } from "@/features/categories/types";

export default function AdminCategoriesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryListItem | null>(null);

  const { data, isLoading, error, refetch } = useCategories({
    pageSize: 500,
    search: search || undefined,
  });

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const allCategories = data?.success && data.data ? data.data : [];

  // This page manages top-level categories only (Women, Men, Beauty, ...).
  const rootCategories = useMemo(
    () => allCategories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
    [allCategories]
  );

  const columns: ColumnDef<CategoryListItem, unknown>[] = [
    {
      id: "image",
      header: "Image",
      cell: ({ row }) => (
        <div className="h-12 w-12 overflow-hidden rounded-xl bg-[var(--color-neutral-100)] ring-1 ring-black/5 shadow-sm transition-transform duration-200 group-hover:scale-105">
          <Image
            src={row.original.icon ? getImageUrl(row.original.icon) : "/images/category_img.png"}
            alt={row.original.name}
            width={48}
            height={48}
            className="h-full w-full object-cover"
          />
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: "Category Name",
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-neutral-900)]">{row.original.name}</p>
      ),
    },
    {
      accessorKey: "slug",
      header: "Category Code",
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-[var(--color-neutral-100)] px-2.5 py-1 font-mono text-xs font-medium uppercase tracking-wide text-[var(--color-neutral-600)] ring-1 ring-inset ring-black/5">
          {row.original.slug}
        </span>
      ),
    },
    {
      accessorKey: "sortOrder",
      header: "Sort Order",
      cell: ({ row }) => (
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-[var(--color-neutral-50)] px-2 text-sm font-semibold tabular-nums text-[var(--color-neutral-700)] ring-1 ring-inset ring-black/5">
          {row.original.sortOrder}
        </span>
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
            aria-label="Edit category"
            className="rounded-xl hover:bg-[var(--color-neutral-100)]"
            onClick={() => {
              setSelectedCategory(row.original);
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4 text-[var(--color-neutral-500)]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete category"
            className="rounded-xl hover:bg-red-50"
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
  if (error) return <ErrorState message="Failed to load categories" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Categories"
        description="Manage your product categories (e.g. Women, Men, Beauty)."
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">
          <div className="flex-shrink-0 mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SearchInput
              placeholder="Search categories..."
              defaultValue={search}
              onSearch={(val) => {
                setSearch(val);
                setPage(1);
              }}
              className="w-full max-w-md"
            />

            <Button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="h-11 rounded-xl bg-gradient-to-b from-[var(--color-primary-400)] to-[var(--color-primary-600)] shadow-[0_6px_16px_-6px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all px-5 text-sm font-semibold text-white hover:-translate-y-px hover:shadow-[0_10px_20px_-8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </div>

          <div className="mt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <DataTable
              columns={columns}
              data={rootCategories}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 30, 50]}
              page={page}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              emptyMessage="No categories found."
              className="bg-white"
            />
          </div>
        </div>
      </AdminContent>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            try {
              await deleteMutation.mutateAsync(deleteId);
              toast.success("Category deleted", "The category was removed successfully.");
              setDeleteId(null);
              refetch();
            } catch (err: any) {
              toast.error("Failed to delete category", err?.message || "Please try again.");
            }
          }
        }}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />

      <FormModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Category"
        description="Create a new top-level category"
      >
        <CategoryForm
          isLoading={createMutation.isPending}
          submitLabel="Create Category"
          onSubmit={async (data) => {
            try {
              const payload = {
                name: data.name,
                slug: data.slug,
                description: data.description,
                icon: data.image,
                sortOrder: Number(data.sortOrder),
                parentId: null,
              };

              await createMutation.mutateAsync(payload);
              toast.success("Category created", `"${data.name}" was added successfully.`);
              setIsCreateOpen(false);
              refetch();
            } catch (err: any) {
              toast.error("Failed to create category", err?.message || "Please try again.");
            }
          }}
        />
      </FormModal>

      <FormModal
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedCategory(null);
        }}
        title="Update Category"
        description="Update the selected category"
      >
        {selectedCategory && (
          <CategoryForm
            initialData={{
              name: selectedCategory.name,
              slug: selectedCategory.slug,
              description: selectedCategory.description,
              image: selectedCategory.icon,
              isActive: selectedCategory.isActive,
              sortOrder: selectedCategory.sortOrder,
            }}
            isEditing
            isLoading={updateMutation.isPending}
            submitLabel="Update Category"
            onSubmit={async (data) => {
              try {
                const payload = {
                  name: data.name,
                  slug: data.slug,
                  description: data.description,
                  icon: data.image,
                  sortOrder: Number(data.sortOrder),
                  parentId: null,
                };

                await updateMutation.mutateAsync({
                  id: selectedCategory.id,
                  data: payload,
                });
                toast.success("Category updated", `"${data.name}" was saved successfully.`);
                setIsEditOpen(false);
                setSelectedCategory(null);
                refetch();
              } catch (err: any) {
                toast.error("Failed to update category", err?.message || "Please try again.");
              }
            }}
          />
        )}
      </FormModal>
    </div>
  );
}
