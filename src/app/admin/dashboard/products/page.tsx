"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useAdminProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/features/products/hooks";
import { useCategories } from "@/features/categories/hooks";
import { useBrands } from "@/features/brands/hooks";
import { useHsnCodes } from "@/features/hsn-codes/hooks";
import { DataTable } from "@/components/admin/data-table/DataTable";
import {
  AdminPageHeader,
  AdminContent,
} from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { SearchInput } from "@/components/ui/search-input";
import { ClearFiltersButton } from "@/components/common/clear-filters-button";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminProductResponse } from "@/features/products/types";
import { ProductForm } from "@/features/products/components/ProductForm";
import { ProductAttributesPanel } from "@/features/products/components/ProductAttributesPanel";
import { ProductImageUploader } from "@/features/products/components/ProductImageUploader";

export default function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] =
    useState<AdminProductResponse | null>(null);
  // Once a new product is created, the modal switches to letting the admin
  // pick its Attributes (Color, Size...) right away - product_attribute_configs
  // needs an existing product row, so this can't happen before creation.
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [createdProductName, setCreatedProductName] = useState<string>("");

  // Main Products Query (filtered by search and selected category)
  const { data, isLoading, error, refetch } = useAdminProducts({
    page,
    pageSize,
    search: search || undefined,
    categoryId: selectedCategoryFilter || undefined,
  });

  // Reference queries for categories filter & modal form dropdowns
  const isModalOpen = isCreateOpen || isEditOpen;
  const { data: categoriesData } = useCategories({ pageSize: 100 });
  const { data: brandsData } = useBrands(
    { limit: 100 },
    { enabled: isModalOpen }
  );
  const { data: hsnData } = useHsnCodes(
    { pageSize: 100 },
    { enabled: isModalOpen }
  );

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const handleClearFilters = () => {
    setSearch("");
    setSelectedCategoryFilter("");
    setPage(1);
  };

  const hasActiveFilters = search.trim() !== "" || selectedCategoryFilter !== "";

  const products = data?.data ?? [];
  const categories = categoriesData?.data ?? [];
  const brands = brandsData?.data ?? [];
  const hsnCodes = hsnData?.data ?? [];

  // Filter Options for category dropdown in toolbar
  const categoryFilterOptions = useMemo(() => {
    return [
      { value: "", label: "All Categories" },
      ...categories.map((c: any) => ({
        value: String(c.uuid || c.id),
        label: c.name,
      })),
    ];
  }, [categories]);

  // Options for form dropdowns (used only when modal is open)
  const categoryOptions = useMemo(() => {
    return categories.map((c: any) => ({
      value: String(c.id || c.uuid),
      label: c.name,
      slug: c.slug,
    }));
  }, [categories]);

  const brandOptions = useMemo(() => {
    return brands.map((b: any) => ({
      value: b.uuid || String(b.id),
      label: b.name,
      slug: b.slug,
    }));
  }, [brands]);

  const hsnOptions = useMemo(() => {
    return hsnCodes.map((h) => ({
      value: h.id,
      label: `${h.code}${h.description ? ` (${h.description})` : ""}`,
    }));
  }, [hsnCodes]);

  const columns: ColumnDef<AdminProductResponse>[] = [
    {
      accessorKey: "name",
      header: "Product Name",
      cell: ({ row }) => (
        <Link
          href={`/admin/dashboard/products/${row.original.id}`}
          className="group block cursor-pointer"
        >
          <p className="font-semibold text-secondary-600 underline-offset-2 group-hover:underline transition-colors">
            {row.original.name}
          </p>
          <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
            {row.original.slug}
          </p>
        </Link>
      ),
    },
    {
      accessorKey: "categoryName",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-[var(--color-neutral-700)]">
          {row.original.categoryName || "—"}
        </span>
      ),
    },
    {
      accessorKey: "hsnCodeName",
      header: "HSN Code",
      cell: ({ row }) => (
        <span className="font-medium text-[var(--color-neutral-700)]">
          {row.original.hsnCodeName || "—"}
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
              setSelectedProduct(row.original);
              setIsEditOpen(true);
            }}
            title="Edit Product"
          >
            <Pencil className="h-4 w-4 text-[var(--color-neutral-500)]" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteId(row.original.id)}
            title="Delete Product"
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
        message="Failed to load products"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Product Management"
        description="Manage your product catalog, categories, brands, and taxes."
      />

      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">
          <div className="flex-shrink-0 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                placeholder="Search products..."
                value={search}
                onSearch={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                className="w-full max-w-md"
              />

              <div className="w-full sm:w-64">
                <Select
                  value={selectedCategoryFilter}
                  onChange={(e) => {
                    setSelectedCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  options={categoryFilterOptions}
                  placeholder="All Categories"
                  className="h-11 rounded-xl"
                />
              </div>

              {hasActiveFilters && <ClearFiltersButton onClick={handleClearFilters} />}
            </div>

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="h-11 rounded-xl bg-[var(--color-secondary-600)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-secondary-700)]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>

          <div className="mt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <DataTable
              columns={columns}
              data={products}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 30, 50]}
              page={data?.meta?.page ?? page}
              totalPages={data?.meta?.totalPages ?? Math.max(1, Math.ceil((data?.meta?.total ?? products.length) / pageSize))}
              totalItems={data?.meta?.total ?? products.length}
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

      {/* CREATE MODAL */}
      <FormModal
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setCreatedProductId(null);
          setCreatedProductName("");
          refetch();
        }}
        title={createdProductId ? "Choose Attributes" : "Add Product"}
        description={
          createdProductId
            ? `Pick which attributes (Color, Size, Material...) apply to "${createdProductName}". You can change this anytime from the product's page.`
            : "Create a new product"
        }
        size="lg"
      >
        {createdProductId ? (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 mb-3">Product Images</h3>
              <ProductImageUploader
                productUuid={createdProductId}
                productName={createdProductName}
              />
            </div>
            <ProductAttributesPanel productUuid={createdProductId} />
            <div className="flex justify-end pt-2 border-t border-neutral-100">
              <Button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setCreatedProductId(null);
                  setCreatedProductName("");
                  refetch();
                }}
                className="h-10 rounded-xl bg-[var(--color-secondary-600)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-secondary-700)]"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <ProductForm
            categories={categoryOptions}
            brands={brandOptions}
            hsnCodes={hsnOptions}
            isLoading={createMutation.isPending}
            submitLabel="Next: Attributes"
            onSubmit={async (formData) => {
              const payload = {
                name: formData.name,
                slug: formData.slug,
                categoryId: formData.categoryId,
                brandId: formData.brandId,
                hsnCodeId: formData.hsnCodeId,
                gender: formData.gender,
              };

              const created = await createMutation.mutateAsync(payload);

              if (created?.data?.id) {
                setCreatedProductId(created.data.id);
                setCreatedProductName(formData.name);
              } else {
                setIsCreateOpen(false);
                refetch();
              }
            }}
          />
        )}
      </FormModal>

      {/* EDIT MODAL */}
      <FormModal
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedProduct(null);
        }}
        title="Update Product"
        description="Update the selected product"
        size="lg"
      >
        {selectedProduct && (
          <ProductForm
            key={selectedProduct.id}
            initialData={{
              name: selectedProduct.name,
              slug: selectedProduct.slug,
              categoryId: selectedProduct.categoryId || "",
              brandId: selectedProduct.brandId || "",
              hsnCodeId: selectedProduct.hsnCodeId || "",
              gender: selectedProduct.gender || "unisex",
            }}
            isEditing
            categories={categoryOptions}
            brands={brandOptions}
            hsnCodes={hsnOptions}
            isLoading={updateMutation.isPending}
            submitLabel="Update Product"
            onSubmit={async (formData) => {
              const payload = {
                name: formData.name,
                slug: formData.slug,
                categoryId: formData.categoryId,
                brandId: formData.brandId,
                hsnCodeId: formData.hsnCodeId,
                gender: formData.gender,
              };

              await updateMutation.mutateAsync({
                uuid: selectedProduct.id,
                data: payload,
              });

              setIsEditOpen(false);
              setSelectedProduct(null);
              refetch();
            }}
          />
        )}

        {selectedProduct && (
          <div className="mt-8 pt-6 border-t border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-900 mb-3">Product Images</h3>
            <ProductImageUploader
              productUuid={selectedProduct.id}
              productName={selectedProduct.name}
            />
          </div>
        )}

        {selectedProduct && (
          <div className="mt-8 pt-6 border-t border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-900 mb-3">Attributes</h3>
            <ProductAttributesPanel productUuid={selectedProduct.id} />
          </div>
        )}
      </FormModal>

      {/* DELETE DIALOG */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId, {
              onSuccess: () => {
                setDeleteId(null);
                refetch();
              },
            });
          }
        }}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
