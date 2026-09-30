"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { ClearFiltersButton } from "@/components/common/clear-filters-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FormModal,
} from "@/components/common/FormModal";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import {
  AdminPageHeader,
  AdminContent,
} from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/data-table/DataTable";
import {
  useInventory,
  useAdjustStock,
  useCreateInventory,
} from "@/features/inventory/hooks";
import { useProducts } from "@/features/products/hooks";
import type {
  InventoryListItem,
  GetInventoryParams,
} from "@/features/inventory/types";

const adjustStockFormSchema = z.object({
  inventoryId: z.number().min(1, "Select an inventory item"),
  direction: z.enum(["in", "out"]),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  notes: z.string().optional(),
});

const createInventoryFormSchema = z.object({
  productId: z.number().min(1, "Select a product"),
  variantId: z.number().optional(),
  quantity: z.number().int().min(0, "Quantity must be at least 0"),
  reorderLevel: z
    .number()
    .int()
    .min(0, "Reorder level must be at least 0")
    .optional(),
});

type AdjustStockForm = z.infer<typeof adjustStockFormSchema>;
type CreateInventoryForm = z.infer<typeof createInventoryFormSchema>;

function getStatusBadge(item: InventoryListItem) {
  if (item.quantity === 0) {
    return <Badge variant="destructive">Out of Stock</Badge>;
  }
  if (item.quantity <= item.reorderLevel) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
        Low Stock
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
      In Stock
    </Badge>
  );
}

export default function InventoryStockPage() {
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, productFilter, colorFilter, lowStockOnly, outOfStockOnly]);

  const params: GetInventoryParams = {
    page,
    limit,
    search: search || undefined,
    productUuid: productFilter || undefined,
    color: colorFilter || undefined,
    lowStock: lowStockOnly || undefined,
    outOfStock: outOfStockOnly || undefined,
  };

  const { data, isLoading, error } = useInventory(params);
  const { data: productsData } = useProducts({ pageSize: 100 });
  const adjustMutation = useAdjustStock();
  const createMutation = useCreateInventory();

  const products = productsData?.data ?? [];
  const productFilterOptions = useMemo(
    () => [
      { value: "", label: "All Products" },
      ...products.map((p: any) => ({ value: p.id, label: p.name })),
    ],
    [products]
  );

  const adjustForm = useForm<AdjustStockForm>({
    resolver: zodResolver(adjustStockFormSchema),
    defaultValues: {
      inventoryId: 0,
      direction: "in",
      quantity: 1,
      notes: "",
    },
  });

  const inventoryData = data?.data?.data ?? [];
  const meta = data?.data?.meta;

  const columns: ColumnDef<InventoryListItem>[] = [
    {
      accessorKey: "productName",
      header: "Product Name",
    },
    {
      accessorKey: "colorName",
      header: "Color",
      cell: ({ row }) => row.original.colorName ?? "—",
    },
    {
      accessorKey: "unitName",
      header: "Unit",
      cell: ({ row }) => row.original.unitName ?? "—",
    },
    {
      accessorKey: "stockIn",
      header: "Stock In",
      cell: ({ row }) => (
        <span className="text-emerald-700 font-semibold">{row.original.stockIn}</span>
      ),
    },
    {
      accessorKey: "stockOut",
      header: "Stock Out",
      cell: ({ row }) => (
        <span className="text-amber-700 font-semibold">{row.original.stockOut}</span>
      ),
    },
    {
      accessorKey: "availableQuantity",
      header: "Available",
    },
    {
      accessorKey: "reorderLevel",
      header: "Reorder Level",
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            adjustForm.reset({
              inventoryId: row.original.id,
              direction: "in",
              quantity: 1,
              notes: "",
            });
            setAdjustOpen(true);
          }}
        >
          Adjust Stock
        </Button>
      ),
    },
  ];

  const createForm = useForm<CreateInventoryForm>({
    resolver: zodResolver(createInventoryFormSchema),
    defaultValues: {
      productId: 0,
      variantId: undefined,
      quantity: 0,
      reorderLevel: 10,
    },
  });

  const handleAdjustSubmit = (values: AdjustStockForm) => {
    const signedQuantity = values.direction === "in" ? values.quantity : -values.quantity;
    adjustMutation.mutate(
      {
        inventoryId: values.inventoryId,
        type: "ADJUSTMENT",
        quantity: signedQuantity,
        notes: values.notes,
      },
      {
        onSuccess: () => {
          setAdjustOpen(false);
          adjustForm.reset();
        },
      }
    );
  };

  const handleCreateSubmit = (values: CreateInventoryForm) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        setCreateOpen(false);
        createForm.reset();
      },
    });
  };

  const handleClearFilters = () => {
    setSearch("");
    setProductFilter("");
    setColorFilter("");
    setLowStockOnly(false);
    setOutOfStockOnly(false);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    productFilter !== "" ||
    colorFilter.trim() !== "" ||
    lowStockOnly ||
    outOfStockOnly;

  if (isLoading) return <AdminTableSkeleton />;
  if (error) return <ErrorState message={error.message} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminBreadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Inventory" },
          { label: "Stock" },
        ]}
      />
      <AdminPageHeader
        title="Inventory Stock"
        description="Stock In / Stock Out / Available stock per color + unit combination"
        actions={
          <Button onClick={() => setCreateOpen(true)}>Add Inventory</Button>
        }
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4">
          <div className="flex-shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <SearchInput
              placeholder="Search by product name..."
              value={search}
              onSearch={setSearch}
              className="w-full max-w-xs"
            />
            <div className="w-full sm:w-56">
              <Select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                options={productFilterOptions}
                placeholder="All Products"
              />
            </div>
            <input
              type="text"
              placeholder="Filter by color..."
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary-600/20 focus:border-secondary-600 w-full sm:w-44"
            />
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-700 cursor-pointer">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => {
                  setLowStockOnly(e.target.checked);
                  if (e.target.checked) setOutOfStockOnly(false);
                }}
                className="rounded border-neutral-300"
              />
              Low stock only
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-700 cursor-pointer">
              <input
                type="checkbox"
                checked={outOfStockOnly}
                onChange={(e) => {
                  setOutOfStockOnly(e.target.checked);
                  if (e.target.checked) setLowStockOnly(false);
                }}
                className="rounded border-neutral-300"
              />
              Out of stock only
            </label>
            {hasActiveFilters && <ClearFiltersButton onClick={handleClearFilters} />}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <DataTable
              columns={columns}
              data={inventoryData}
              className="bg-white border border-neutral-200"
            />
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex-shrink-0 flex items-center justify-between text-xs text-neutral-600">
              <span>
                Page {meta.page} of {meta.totalPages} ({meta.total} items)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </AdminContent>

      <FormModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Adjust Stock"
        description="Add or remove stock for this color + unit combination"
        footer={
          <>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onClick={adjustForm.handleSubmit(handleAdjustSubmit)} disabled={adjustMutation.isPending}>
              {adjustMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Inventory Item <span className="text-red-500">*</span></label>
            <Select
              value={adjustForm.watch("inventoryId") ? String(adjustForm.watch("inventoryId")) : ""}
              placeholder="Select item"
              onValueChange={(val) => adjustForm.setValue("inventoryId", Number(val), { shouldValidate: true })}
              options={(inventoryData ?? []).map((item) => ({
                value: String(item.id),
                label: `${item.productName}${item.colorName ? ` - ${item.colorName}` : ""}${item.unitName ? ` (${item.unitName})` : ""}`,
              }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Direction <span className="text-red-500">*</span></label>
            <div className="flex gap-2 mt-1">
              <label className="flex-1 flex items-center justify-center gap-1.5 border rounded-md p-2 text-sm font-semibold cursor-pointer has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-700">
                <input type="radio" value="in" className="hidden" {...adjustForm.register("direction")} />
                Stock In
              </label>
              <label className="flex-1 flex items-center justify-center gap-1.5 border rounded-md p-2 text-sm font-semibold cursor-pointer has-[:checked]:border-amber-600 has-[:checked]:bg-amber-50 has-[:checked]:text-amber-700">
                <input type="radio" value="out" className="hidden" {...adjustForm.register("direction")} />
                Stock Out
              </label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              className="w-full border rounded-md p-2"
              {...adjustForm.register("quantity", { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="w-full border rounded-md p-2"
              {...adjustForm.register("notes")}
            />
          </div>
        </div>
      </FormModal>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Inventory"
        description="Create a new inventory record"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createForm.handleSubmit(handleCreateSubmit)} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Product ID <span className="text-red-500">*</span></label>
            <input
              type="number"
              className="w-full border rounded-md p-2"
              placeholder="Enter product ID"
              {...createForm.register("productId", { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Variant ID (optional)</label>
            <input
              type="number"
              className="w-full border rounded-md p-2"
              placeholder="Enter variant ID"
              {...createForm.register("variantId", { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Quantity <span className="text-red-500">*</span></label>
            <input
              type="number"
              className="w-full border rounded-md p-2"
              {...createForm.register("quantity", { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Reorder Level</label>
            <input
              type="number"
              className="w-full border rounded-md p-2"
              {...createForm.register("reorderLevel", { valueAsNumber: true })}
            />
          </div>
        </div>
      </FormModal>
    </div>
  );
}
