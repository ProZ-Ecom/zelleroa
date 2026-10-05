"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon } from "@/features/coupons/hooks";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createCouponSchema, type CreateCouponSchemaInput } from "@/features/coupons/validations/coupon.schema";
import type { ColumnDef } from "@tanstack/react-table";
import type { CouponListItem } from "@/features/coupons/types";

const typeBadgeVariant: Record<string, "info" | "success"> = {
  PERCENTAGE: "info",
  FIXED: "success",
};

export default function AdminCouponsPage() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponListItem | null>(null);

  const { data, isLoading, error, refetch } = useCoupons({
    search: search || undefined,
  });

  const createMutation = useCreateCoupon();
  const updateMutation = useUpdateCoupon();
  const deleteMutation = useDeleteCoupon();

  const coupons = data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateCouponSchemaInput>({
    resolver: zodResolver(createCouponSchema),
    defaultValues: {
      code: "",
      type: "PERCENTAGE",
      value: 0,
      isActive: true,
    },
  });

  const handleNumericInputBlur = (field: "value" | "minOrderAmount" | "maxDiscount" | "usageLimit") => (
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    const raw = e.target.value;
    if (raw && /^0+\d+/.test(raw)) {
      const normalized = Number(raw);
      setValue(field, isNaN(normalized) ? undefined : (normalized as any), { shouldValidate: true });
      e.target.value = String(normalized);
    }
  };

  useEffect(() => {
    if (editingCoupon) {
      reset({
        code: editingCoupon.code,
        type: editingCoupon.type as "PERCENTAGE" | "FIXED",
        value: editingCoupon.value,
        minOrderAmount: editingCoupon.minOrderAmount ?? undefined,
        maxDiscount: editingCoupon.maxDiscount ?? undefined,
        usageLimit: editingCoupon.usageLimit ?? undefined,
        isActive: editingCoupon.isActive,
        startsAt: editingCoupon.startsAt
          ? new Date(editingCoupon.startsAt).toISOString().split("T")[0]
          : undefined,
        expiresAt: editingCoupon.expiresAt
          ? new Date(editingCoupon.expiresAt).toISOString().split("T")[0]
          : undefined,
      });
    } else {
      reset({ code: "", type: "PERCENTAGE", value: 0, isActive: true });
    }
  }, [editingCoupon, reset]);

  const onSubmit = (formData: CreateCouponSchemaInput) => {
    if (editingCoupon) {
      updateMutation.mutate(
        { id: editingCoupon.id, data: formData },
        {
          onSuccess: () => {
            setModalOpen(false);
            setEditingCoupon(null);
          },
        }
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => {
          setModalOpen(false);
          reset();
        },
      });
    }
  };

  const handleOpenModal = (coupon?: CouponListItem) => {
    if (coupon) {
      setEditingCoupon(coupon);
    } else {
      setEditingCoupon(null);
    }
    setModalOpen(true);
  };

  const columns: ColumnDef<CouponListItem, unknown>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <p className="font-mono font-medium">{row.original.code}</p>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant={typeBadgeVariant[row.original.type] ?? "secondary"}>
          {row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: "value",
      header: "Value",
      cell: ({ row }) =>
        row.original.type === "PERCENTAGE"
          ? `${row.original.value}%`
          : `₹${row.original.value}`,
    },
    {
      id: "usage",
      header: "Usage",
      cell: ({ row }) => (
        <span>
          {row.original.usedCount}
          {row.original.usageLimit ? ` / ${row.original.usageLimit}` : ""}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorKey: "expiresAt",
      header: "Expiry",
      cell: ({ row }) =>
        row.original.expiresAt
          ? new Date(row.original.expiresAt).toLocaleDateString("en-IN")
          : "No expiry",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenModal(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteId(row.original.id)}
          >
            <Trash2 className="h-4 w-4 text-error-600" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading && !data) return <AdminTableSkeleton />;
  if (error) return <ErrorState message="Failed to load coupons" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminBreadcrumb items={[{ label: "Coupons" }]} />
      <AdminPageHeader
        title="Coupons"
        description="Manage discount coupons"
        actions={
          <Button onClick={() => handleOpenModal()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Coupon
          </Button>
        }
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <DataTable
            columns={columns}
            data={coupons}
            searchKey="code"
            searchPlaceholder="Search coupons..."
            pageSize={20}
            className="bg-white border border-neutral-200"
          />
        </div>
      </AdminContent>

      <FormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCoupon(null);
        }}
        title={editingCoupon ? "Edit Coupon" : "Add Coupon"}
        description={editingCoupon ? "Update coupon details" : "Create a new coupon"}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setEditingCoupon(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingCoupon ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code <span className="text-error-600">*</span>
            </label>
            <input
              {...register("code")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="e.g. SUMMER20"
            />
            {errors.code && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.code.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="text-error-600">*</span>
              </label>
              <select
                {...register("type")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed Amount</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value <span className="text-error-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register("value", { valueAsNumber: true })}
                onBlur={handleNumericInputBlur("value")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="0"
              />
              {errors.value && (
                <p className="mt-1 text-xs text-red-500 font-medium">{errors.value.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Order Amount
              </label>
              <input
                type="number"
                step="0.01"
                {...register("minOrderAmount", { valueAsNumber: true })}
                onBlur={handleNumericInputBlur("minOrderAmount")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Discount
              </label>
              <input
                type="number"
                step="0.01"
                {...register("maxDiscount", { valueAsNumber: true })}
                onBlur={handleNumericInputBlur("maxDiscount")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usage Limit
            </label>
            <input
              type="number"
              {...register("usageLimit", { valueAsNumber: true })}
              onBlur={handleNumericInputBlur("usageLimit")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Unlimited"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Starts At
              </label>
              <input
                type="date"
                {...register("startsAt")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expires At
              </label>
              <input
                type="date"
                {...register("expiresAt")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register("isActive")}
              id="isActive"
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>
        </form>
      </FormModal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId, {
              onSuccess: () => setDeleteId(null),
            });
          }
        }}
        title="Delete Coupon"
        description="Are you sure you want to delete this coupon? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
