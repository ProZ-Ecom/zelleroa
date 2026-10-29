"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from "@/features/brands/hooks";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
// import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { formatSlug } from "@/components/forms/form-input";
import { ExcelImportDialog } from "@/components/common/ExcelImportDialog";
import { createAdminBrandSchema } from "@/features/brands/validations/admin-brand.schema";
// import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { ExportButton } from "@/components/common/export-button";
import { exportDataToCsv } from "@/lib/export-csv";
import { toast } from "@/components/ui/Toast";
import { Upload, Plus, Pencil, Trash2, Filter } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { BrandListItem } from "@/features/brands/types";
import { BrandForm } from "@/features/brands/components/BrandForm";
import { SearchInput } from "@/components/ui/search-input";

export default function AdminBrandsPage() {
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<BrandListItem | null>(null);

  const { data, isLoading, error, refetch } = useBrands({
    page,
    limit: pageSize,
    search: search || undefined,
  });

  const createMutation = useCreateBrand();
  const updateMutation = useUpdateBrand();
  const deleteMutation = useDeleteBrand();

  const brands = data?.data ?? [];

  const columns: ColumnDef<BrandListItem, unknown>[] = [
  // {
  //   id: "logo",
  //   header: "Logo",
  //   cell: ({ row }) => (
  //     <div className="h-12 w-12 overflow-hidden rounded-xl bg-[var(--color-neutral-100)]">
  //       <Image
  //         src={row.original.icon || "/images/category_img.png"}
  //         alt={row.original.name}
  //         width={48}
  //         height={48}
  //         className="h-full w-full object-cover"
  //       />
  //     </div>
  //   ),
  // },
  {
    accessorKey: "name",
    header: "Brand Name",
    cell: ({ row }) => (
      <div>
        <p className="font-semibold text-[var(--color-neutral-900)]">
          {row.original.name}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "slug",
    header: "Brand Code",
    cell: ({ row }) => (
      <div>
        <p className="text-sm text-[var(--color-neutral-600)]">
          {row.original.slug || "—"}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "_count.products",
    header: "Products",
    cell: ({ row }) => (
      <span className="text-[var(--color-neutral-700)]">
        {row.original._count?.products || 0} Items
      </span>
    ),
  },
  // {
  //   accessorKey: "isActive",
  //   header: "Status",
  //   cell: ({ row }) =>
  //     row.original.isActive ? (
  //       <span className="inline-flex items-center rounded-full bg-[var(--color-success-50)] px-3 py-1 text-xs font-medium text-[var(--color-success-700)]">
  //         Active
  //       </span>
  //     ) : (
  //       <span className="inline-flex items-center rounded-full bg-[var(--color-neutral-100)] px-3 py-1 text-xs font-medium text-[var(--color-neutral-600)]">
  //         Inactive
  //       </span>
  //     ),
  // },
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setSelectedBrand(row.original);
            setIsEditOpen(true);
          }}
        >
          <Pencil className="h-4 w-4 text-[var(--color-neutral-500)]" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDeleteId(row.original.uuid)}
        >
          <Trash2 className="h-4 w-4 text-[var(--color-error-600)]" />
        </Button>
      </div>
    ),
  },
];

  // Check permission / auth errors FIRST — before isLoading — so that even when
  // keepPreviousData is active and stale data exists, a permission error takes
  // priority over rendering the table with stale data.
  if (error) {
    const errMsg = (error as { message?: string })?.message ?? "";
    const isPermissionError =
      errMsg.toLowerCase().includes("permission") ||
      errMsg.toLowerCase().includes("unauthorized") ||
      (error as { status?: number })?.status === 403;

    if (isPermissionError) {
      return (
        <div className="flex flex-1 min-h-0 flex-col">
          <AdminPageHeader
            title="Brand Management"
            description="Manage product brands and their associated catalogs."
          />
          <AdminContent>
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="rounded-full bg-red-50 p-5">
                <svg
                  className="h-10 w-10 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-neutral-800">
                Access Denied
              </h2>
              <p className="text-sm text-neutral-500 max-w-sm">
                You don&apos;t have permission to view Brands. Please contact your administrator.
              </p>
            </div>
          </AdminContent>
        </div>
      );
    }

    return <ErrorState message="Failed to load brands" onRetry={() => refetch()} />;
  }

  if (isLoading && !data) {
    return <AdminTableSkeleton />;
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* <AdminBreadcrumb items={[{ label: "Brands" }]} /> */}
      <AdminPageHeader
        title="Brand Management"
        description="Manage product brands and their associated catalogs."
      />
      
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">

          {/* Search + Filter */}
          <div className="flex-shrink-0 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SearchInput
              placeholder="Search brands..."
              defaultValue={search}
              onSearch={(val) => {
                setSearch(val);
                setPage(1);
              }}
              className="w-full max-w-md"
            />
            <div className="flex items-center gap-2">
              <ExportButton
                onClick={() =>
                  exportDataToCsv(
                    brands,
                    "brands",
                    [
                      { header: "Brand Name", accessor: (b) => b.name },
                      { header: "Brand Code", accessor: (b) => b.slug || "—" },
                      { header: "Description", accessor: (b) => b.description || "—" },
                      { header: "Products", accessor: (b) => `${b._count?.products || 0} Items` },
                      {
                        header: "Created Date",
                        accessor: (b) =>
                          b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN") : "—",
                      },
                    ]
                  )
                }
                disabled={!brands.length}
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
                Add Brand
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="mt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <DataTable
              columns={columns}
              data={brands}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 30, 50]}
              page={data?.meta?.page ?? page}
              totalPages={data?.meta?.totalPages ?? Math.max(1, Math.ceil((data?.meta?.total ?? brands.length) / pageSize))}
              totalItems={data?.meta?.total ?? brands.length}
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
      <ExcelImportDialog
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Brands"
        sampleFileName="brands"
        columns={[
          { key: "name", header: "Brand Name", required: true, info: "Brand name, must be unique.", samples: ["Aashirvaad", "Tata Salt"] },
          { key: "slug", header: "Brand Code", info: "Capital letters, numbers and underscores only (e.g. ZELLEROA_COUTURE). Spaces become _ and other characters are removed. Generated from the name if blank.", samples: ["aashirvaad", "tata-salt"] },
          { key: "description", header: "Description", samples: ["Atta and spices", "Iodised salt"] },
        ]}
                prepare={(row) => ({
          ...row,
          slug: formatSlug(String(row.slug ?? row.name ?? "")),
        })}
        schema={createAdminBrandSchema}
        createRow={(payload) => createMutation.mutateAsync(payload)}
        onImported={() => refetch()}
      />


      <FormModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Brand"
        description="Create a new product brand"
      >
        <BrandForm
          isLoading={createMutation.isPending}
          submitLabel="Create Brand"
          onSubmit={async (formData) => {
            const payload = {
              name: formData.name,
              slug: formData.slug,
              description: formData.description || null,
            };

            await createMutation.mutateAsync(payload);
            toast.success("Brand created", `"${formData.name}" was added.`);
            setIsCreateOpen(false);
            refetch();
          }}
        />
      </FormModal>

      <FormModal
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedBrand(null);
        }}
        title="Update Brand"
        description="Update the selected brand"
      >
        {selectedBrand && (
          <BrandForm
            initialData={{
              name: selectedBrand.name,
              slug: selectedBrand.slug,
              description: selectedBrand.description,
            }}
            isEditing
            isLoading={updateMutation.isPending}
            submitLabel="Update Brand"
            onSubmit={async (formData) => {
              const payload = {
                name: formData.name,
                slug: formData.slug,
                description: formData.description || null,
              };

              await updateMutation.mutateAsync({
                uuid: selectedBrand.uuid,
                data: payload,
              });

              toast.success("Brand updated", `"${formData.name}" was saved.`);
              setIsEditOpen(false);
              setSelectedBrand(null);
              refetch();
            }}
          />
        )}
      </FormModal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId, {
              onSuccess: () => {
                toast.success("Brand deleted", "The brand has been removed.");
                setDeleteId(null);
                refetch();
              },
            });
          }
        }}
        title="Delete Brand"
        description="Are you sure you want to delete this brand? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
