"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { SearchInput } from "@/components/ui/search-input";
import { ClearFiltersButton } from "@/components/common/clear-filters-button";
import { useCategories } from "@/features/categories/hooks";
import { useAdminProducts } from "@/features/products/hooks";
import {
  useStyleList,
  useCreateStyle,
  useUpdateStyle,
  useDeleteStyle,
} from "@/features/styles/hooks";
import { StyleForm, type StyleFormValues } from "@/features/styles/components";
import type { AdminStyleResponse } from "@/features/styles/types";
import { toast } from "@/components/ui/Toast";

export default function AdminStylesPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addProductUuid, setAddProductUuid] = useState("");
  const [editingStyle, setEditingStyle] = useState<AdminStyleResponse | null>(null);
  const [deletingStyle, setDeletingStyle] = useState<AdminStyleResponse | null>(null);

  const { data, isLoading, error, refetch } = useStyleList({
    page,
    pageSize,
    search: search || undefined,
    categoryId: categoryFilter || undefined,
    productId: productFilter || undefined,
  });

  const { data: categoriesData } = useCategories({ pageSize: 100 });
  const { data: productsData } = useAdminProducts({ pageSize: 100 }); // API max is 100

  const createStyleMutation = useCreateStyle();
  const updateStyleMutation = useUpdateStyle();
  const deleteStyleMutation = useDeleteStyle();

  const styles = data?.data ?? [];
  const categories = categoriesData?.data ?? [];
  const products = productsData?.data ?? [];

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All Categories" },
      ...categories.map((c: any) => ({ value: String(c.uuid || c.id), label: c.name })),
    ],
    [categories]
  );

  const productOptions = useMemo(
    () => products.map((p: any) => ({ value: p.id, label: p.name })),
    [products]
  );

  const productFilterOptions = useMemo(
    () => [{ value: "", label: "All Products" }, ...productOptions],
    [productOptions]
  );

  const hasActiveFilters = Boolean(search.trim()) || Boolean(categoryFilter) || Boolean(productFilter);

  const handleClearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setProductFilter("");
    setPage(1);
  };

  const columns: ColumnDef<AdminStyleResponse>[] = [
    {
      accessorKey: "name",
      header: "Item Name",
      cell: ({ row }) => (
        <Link href={`/admin/dashboard/styles/${row.original.id}`} className="group block cursor-pointer">
          <p className="font-semibold text-secondary-600 underline-offset-2 group-hover:underline transition-colors">
            {row.original.name}
          </p>
          <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">{row.original.slug}</p>
        </Link>
      ),
    },
    {
      accessorKey: "productName",
      header: "Product",
      cell: ({ row }) => <span className="text-[var(--color-neutral-700)]">{row.original.productName || "—"}</span>,
    },
    {
      accessorKey: "brandName",
      header: "Brand",
      cell: ({ row }) => <span className="text-[var(--color-neutral-700)]">{row.original.brandName || "—"}</span>,
    },
    {
      accessorKey: "categoryName",
      header: "Category",
      cell: ({ row }) => <span className="text-[var(--color-neutral-700)]">{row.original.categoryName || "—"}</span>,
    },
    {
      accessorKey: "itemCount",
      header: "Items",
      cell: ({ row }) => <span className="text-[var(--color-neutral-700)]">{row.original.itemCount}</span>,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
            row.original.isActive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created Date",
      cell: ({ row }) => (
        <span className="text-[var(--color-neutral-700)]">
          {new Date(row.original.createdAt).toLocaleDateString("en-IN")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1.5">
          <Link href={`/admin/dashboard/styles/${row.original.id}`}>
            <Button variant="ghost" size="icon" title="View Item">
              <Eye className="h-4 w-4 text-[var(--color-neutral-500)]" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditingStyle(row.original)}
            title="Edit Item"
          >
            <Pencil className="h-4 w-4 text-[var(--color-neutral-500)]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeletingStyle(row.original)}
            title="Delete Item"
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
    return <ErrorState message="Failed to load items" onRetry={() => refetch()} />;
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Item Management"
        description="Manage the sellable Items customers see - each groups one or more admin-only Models."
      />

      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">
          <div className="flex-shrink-0 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                placeholder="Search items..."
                value={search}
                onSearch={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                className="w-full max-w-md"
              />

              <div className="w-full sm:w-56">
                <Select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  options={categoryOptions}
                  placeholder="All Categories"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="w-full sm:w-56">
                <Select
                  value={productFilter}
                  onChange={(e) => {
                    setProductFilter(e.target.value);
                    setPage(1);
                  }}
                  options={productFilterOptions}
                  placeholder="All Products"
                  className="h-11 rounded-xl"
                />
              </div>

              {hasActiveFilters && <ClearFiltersButton onClick={handleClearFilters} />}
            </div>

            <Button
              onClick={() => setIsAddOpen(true)}
              className="h-11 rounded-xl bg-[var(--color-secondary-600)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-secondary-700)]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>

          <div className="mt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <DataTable
              columns={columns}
              data={styles}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 30, 50]}
              page={data?.meta?.page ?? page}
              totalPages={data?.meta?.totalPages ?? Math.max(1, Math.ceil((data?.meta?.total ?? styles.length) / pageSize))}
              totalItems={data?.meta?.total ?? styles.length}
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

      {/* ADD STYLE MODAL */}
      <FormModal
        open={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setAddProductUuid("");
        }}
        title="Add Item"
        description="Create a new sellable Item under a Product"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-neutral-800)] mb-1.5">
              Product <span className="text-red-500">*</span>
            </label>
            <Select
              value={addProductUuid}
              onChange={(e) => setAddProductUuid(e.target.value)}
              options={productOptions}
              placeholder="Select a product"
              className="h-10 rounded-lg"
            />
          </div>

          {addProductUuid && (
            <StyleForm
              defaultBrandId={products.find((p) => p.id === addProductUuid)?.brandId ?? null}
              isLoading={createStyleMutation.isPending}
              submitLabel="Create Item"
              onSubmit={async (formData: StyleFormValues) => {
                try {
                  await createStyleMutation.mutateAsync({
                    productUuid: addProductUuid,
                    data: {
                      brandId: formData.brandId,
                      name: formData.name,
                      slug: formData.slug,
                      sku: formData.sku || null,
                      shortDescription: formData.shortDescription || null,
                      description: formData.description || null,
                      ingredients: null,
                      isReadyToMix: false,
                      cookingRecipe: formData.cookingRecipe || null,
                      shelfLife: null,
                      vegType: "na",
                      basePrice: formData.basePrice ?? 0,
                      isFeatured: formData.isFeatured,
                      isDefault: formData.isDefault ?? false,
                      isActive: formData.isActive,
                    },
                  });
                  setIsAddOpen(false);
                  setAddProductUuid("");
                  toast.success("Item created", `"${formData.name}" was added.`);
                  refetch();
                } catch (err: any) {
                  toast.error("Failed to create item", err?.message || "Please try again.");
                }
              }}
            />
          )}
        </div>
      </FormModal>

      {/* EDIT STYLE MODAL */}
      <FormModal
        open={Boolean(editingStyle)}
        onClose={() => setEditingStyle(null)}
        title="Edit Item"
        description={`Update information for ${editingStyle?.name || ""}`}
        size="lg"
      >
        {editingStyle && (
          <StyleForm
            isEditing
            initialData={{
              brandId: editingStyle.brandId || "",
              name: editingStyle.name,
              slug: editingStyle.slug,
              sku: editingStyle.sku || "",
              shortDescription: editingStyle.shortDescription || "",
              description: editingStyle.description || "",
              cookingRecipe: editingStyle.cookingRecipe || "",
              basePrice: editingStyle.basePrice ?? 0,
              isFeatured: editingStyle.isFeatured,
              isDefault: editingStyle.isDefault,
              isActive: editingStyle.isActive,
            }}
            isLoading={updateStyleMutation.isPending}
            submitLabel="Save Changes"
            onSubmit={async (formData: StyleFormValues) => {
              if (!editingStyle) return;
              try {
                await updateStyleMutation.mutateAsync({
                  productUuid: editingStyle.productId,
                  styleUuid: editingStyle.id,
                  data: {
                    brandId: formData.brandId,
                    name: formData.name,
                    slug: formData.slug,
                    sku: formData.sku || null,
                    shortDescription: formData.shortDescription || null,
                    description: formData.description || null,
                    ingredients: editingStyle.ingredients || null,
                    isReadyToMix: editingStyle.isReadyToMix ?? false,
                    cookingRecipe: formData.cookingRecipe || null,
                    shelfLife: editingStyle.shelfLife || null,
                    vegType: editingStyle.vegType || "na",
                    basePrice: formData.basePrice ?? 0,
                    isFeatured: formData.isFeatured,
                    isDefault: formData.isDefault ?? false,
                    isActive: formData.isActive,
                  },
                });
                setEditingStyle(null);
                toast.success("Item updated", `"${formData.name}" was saved.`);
                refetch();
              } catch (err: any) {
                toast.error("Failed to update item", err?.message || "Please try again.");
              }
            }}
          />
        )}
      </FormModal>

      {/* DELETE DIALOG */}
      <ConfirmDialog
        open={!!deletingStyle}
        onClose={() => setDeletingStyle(null)}
        onConfirm={async () => {
          if (!deletingStyle) return;
          const target = deletingStyle;
          setDeletingStyle(null);
          try {
            await deleteStyleMutation.mutateAsync({
              productUuid: target.productId,
              styleUuid: target.id,
            });
            toast.success("Item deleted", `"${target.name}" was removed.`);
            refetch();
          } catch (err: any) {
            toast.error("Failed to delete item", err?.message || "Please try again.");
          }
        }}
        title="Delete Item"
        description={`Are you sure you want to delete "${deletingStyle?.name}"? Its Items, Colors and Sizes will no longer be manageable. This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteStyleMutation.isPending}
      />
    </div>
  );
}
