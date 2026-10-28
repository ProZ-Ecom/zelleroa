"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "@/components/ui/Toast";
import {
  useAdminProducts,
  useAdminProductsCount,
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
import Image from "next/image";
import { getImageUrl } from "@/lib/utils";
import { ExcelImportDialog } from "@/components/common/ExcelImportDialog";
import { NoImagePlaceholder } from "@/components/common/NoImagePlaceholder";
import { MissingImageBanner } from "@/components/common/MissingImageBanner";
import { createAdminProductSchema } from "@/features/products/validations/admin-product.schema";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { SearchInput } from "@/components/ui/search-input";
import { ClearFiltersButton } from "@/components/common/clear-filters-button";
import { ExportButton } from "@/components/common/export-button";
import { exportDataToCsv } from "@/lib/export-csv";
import Link from "next/link";
import { Upload, Plus, Pencil, Trash2 } from "lucide-react";
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
  const [isImportOpen, setIsImportOpen] = useState(false);
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

  // Counted across the whole filtered set, not just the page on screen, so the
  // reminder still shows when the products without an image sit on a later page.
  const { data: counts, refetch: refetchCounts } = useAdminProductsCount({
    search: search || undefined,
    categoryId: selectedCategoryFilter || undefined,
  });

  // Reference queries for categories filter & modal form dropdowns
  const isModalOpen = isCreateOpen || isEditOpen || isImportOpen;
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
      ...categories
        .filter((c: { parentId?: string | number | null }) => !c.parentId)
        .map((c: { uuid?: string; id?: string | number; name: string }) => ({
          value: String(c.uuid || c.id),
          label: c.name,
        })),
    ];
  }, [categories]);

  // Options for form dropdowns (strictly the master categories)
  const categoryOptions = useMemo(() => {
    return categories
      .filter((c: { parentId?: string | number | null }) => !c.parentId)
      .map((c: { id?: string | number; uuid?: string; name: string; slug: string }) => ({
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
      id: "image",
      header: "Image",
      cell: ({ row }) =>
        row.original.imageUrl ? (
          <div className="h-12 w-12 overflow-hidden rounded-xl bg-[var(--color-neutral-100)] ring-1 ring-black/5 shadow-sm">
            <Image
              src={getImageUrl(row.original.imageUrl)}
              alt={row.original.imageAlt || row.original.name}
              width={48}
              height={48}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <NoImagePlaceholder size={48} />
        ),
    },
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
      accessorKey: "gender",
      header: "Gender",
      cell: ({ row }) => {
        const g = row.original.gender;
        const labels: Record<string, string> = {
          men: "Men",
          women: "Women",
          kids: "Kids",
          unisex: "Unisex",
          not_applicable: "N/A",
        };
        return (
          <span className="text-[var(--color-neutral-700)]">
            {g ? labels[g] ?? g : "—"}
          </span>
        );
      },
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
    const errorMsg =
      (error as any)?.message ||
      (error as any)?.response?.data?.message ||
      "Failed to load products";
    return (
      <ErrorState
        title={errorMsg.includes("permission") ? "You don't have permission" : "Something went wrong"}
        message={errorMsg}
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
                  onValueChange={(val) => {
                    setSelectedCategoryFilter(val);
                    setPage(1);
                  }}
                  options={categoryFilterOptions}
                  placeholder="All Categories"
                />
              </div>

              {hasActiveFilters && <ClearFiltersButton onClick={handleClearFilters} />}
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                onClick={() =>
                  exportDataToCsv(
                    products,
                    "products",
                    [
                      { header: "Product Name", accessor: (p) => p.name },
                      { header: "Slug", accessor: (p) => p.slug },
                      { header: "Category", accessor: (p) => p.categoryName || "—" },
                      { header: "Brand", accessor: (p) => p.brandName || "—" },
                      { header: "Gender", accessor: (p) => p.gender || "—" },
                      { header: "HSN Code", accessor: (p) => p.hsnCodeName || "—" },
                      { header: "Status", accessor: (p) => (p.isActive ? "Active" : "Inactive") },
                    ]
                  )
                }
                disabled={!products.length}
              />

              <Button
                variant="outline"
                onClick={() => setIsImportOpen(true)}
                className="h-11 rounded-xl px-5 text-sm font-semibold"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>

              <Button
                onClick={() => setIsCreateOpen(true)}
                className="h-11 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-5 text-sm font-semibold text-white transition-colors"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>
          </div>

          <MissingImageBanner count={counts?.withoutImage ?? 0} noun="products" />

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
      <ExcelImportDialog
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Products"
        sampleFileName="products"
        columns={[
          { key: "name", header: "Product Name", required: true, info: "Product name, max 200 characters.", samples: ["Cotton Kurti", "Silk Saree", "Kids T-Shirt"] },
          { key: "slug", header: "Product Code", required: true, info: "Your part of the code (e.g. KURTI_01). Capital letters, spaces become _. The category code is added in front automatically.", samples: ["KURTI_01", "SAREE_01", "TSHIRT_01"] },
          { key: "category", header: "Category Name", required: true, info: "Must match an existing category name exactly.", samples: ["Women", "Women", "Kids"] },
          { key: "brand", header: "Brand Name", info: "Must match an existing brand name. First brand is used if blank.", samples: ["Zelleroa Couture", "Zelleroa Couture", "Zelleroa Kids"] },
          { key: "hsn", header: "HSN Code", required: true, info: "Must match an existing HSN code (e.g. 6109).", samples: ["6104", "5007", "6109"] },
          { key: "gender", header: "Gender", required: true, info: "One of: men, women, kids, unisex, not_applicable.", samples: ["women", "women", "kids"] },
        ]}
        hint="Category, Brand and HSN Code must already exist."
        imageNotice="Product images cannot be sent in an Excel file. Imported products are created without one — open each product after the import and upload its images, along with its attributes."
        prepare={(row) => {
          const find = <T,>(list: T[], key: (item: T) => string, value: unknown) =>
            list.find((item) => key(item).trim().toLowerCase() === String(value ?? "").trim().toLowerCase());

          const category = find(categoryOptions, (c) => c.label, row.category);
          if (!category) return { error: `Category "${row.category ?? ""}" not found` };

          let brandId: string | undefined = brandOptions[0]?.value;
          if (row.brand !== undefined) {
            const brand = find(brandOptions, (b) => b.label, row.brand);
            if (!brand) return { error: `Brand "${row.brand}" not found` };
            brandId = brand.value;
          }

          const hsn = hsnCodes.find((h) => h.code.trim().toLowerCase() === String(row.hsn ?? "").trim().toLowerCase());
          if (!hsn) return { error: `HSN code "${row.hsn ?? ""}" not found` };

          const prefix = category.slug ? `${category.slug.toUpperCase()}_` : "";
          const suffix = String(row.slug ?? "").trim().toUpperCase().replace(/\s+/g, "_");
          return {
            name: row.name,
            slug: suffix ? `${prefix}${suffix}` : "",
            categoryId: category.value,
            brandId,
            hsnCodeId: hsn.id,
            gender: typeof row.gender === "string" ? row.gender.toLowerCase().replace(/\s+/g, "_") : row.gender,
          };
        }}
        schema={createAdminProductSchema}
        createRow={(payload) => createMutation.mutateAsync(payload)}
        onImported={() => {
          refetch();
          refetchCounts();
        }}
      />

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
                className="h-10 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-5 text-sm font-semibold text-white transition-colors"
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
              try {
                const payload = {
                  name: formData.name,
                  slug: formData.slug,
                  categoryId: formData.categoryId,
                  brandId: formData.brandId,
                  hsnCodeId: formData.hsnCodeId,
                  gender: formData.gender,
                };

                const created = await createMutation.mutateAsync(payload);
                toast.success("Product created", `"${formData.name}" is ready for attributes.`);

                if (created?.data?.id) {
                  setCreatedProductId(created.data.id);
                  setCreatedProductName(formData.name);
                } else {
                  setIsCreateOpen(false);
                  refetch();
                }
              } catch (err: any) {
                toast.error("Failed to create product", err?.message || "Please try again.");
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
              try {
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
                toast.success("Product updated", `"${formData.name}" was saved successfully.`);

                setIsEditOpen(false);
                setSelectedProduct(null);
                refetch();
              } catch (err: any) {
                toast.error("Failed to update product", err?.message || "Please try again.");
              }
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
        onConfirm={async () => {
          if (deleteId) {
            try {
              await deleteMutation.mutateAsync(deleteId);
              toast.success("Product deleted", "The product was removed successfully.");
              setDeleteId(null);
              refetch();
            } catch (err: any) {
              toast.error("Failed to delete product", err?.message || "Please try again.");
            }
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
