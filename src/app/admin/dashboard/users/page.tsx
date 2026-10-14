"use client";

import React, { useState, useEffect, useMemo } from "react";
import { EMAIL_MAX_LENGTH } from "@/lib/validations/email";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/Toast";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetUserPassword,
} from "@/features/users/hooks";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { ExportButton } from "@/components/common/export-button";
import { exportDataToCsv } from "@/lib/export-csv";
import { SearchInput } from "@/components/ui/search-input";
import { Plus, Pencil, Trash2, KeyRound, RotateCcw } from "lucide-react";
import { z } from "zod";
   import { cn } from "@/lib/utils";
import {
  createUserSchema,
  resetPasswordSchema,
  indiaPhoneSchema,
  type CreateUserSchemaInput,
} from "@/features/users/validations/user.schema";
import type { ColumnDef } from "@tanstack/react-table";
import type { UserListItem } from "@/features/users/types";

type ModalMode = "create" | "edit" | "resetPassword" | null;

interface UserFormValues {
  name: string;
  email: string;
  password?: string;
  phone: string;
  roleId?: number;
  status?: "active" | "inactive" | "banned";
}

const roleColors: Record<string, string> = {
  ADMIN: "!bg-purple-100 !text-purple-700 !border-purple-300",
  STAFF: "!bg-blue-100 !text-blue-700 !border-blue-300",
  AGENT: "!bg-orange-100 !text-orange-700 !border-orange-300",
 CUSTOMER: "!bg-slate-100 !text-slate-700 !border-slate-300",
};

export default function AdminUsersPage() {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | number | null>(null);

 const { data, isLoading, error, refetch } = useUsers({ page: 1, limit: 100 });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const resetPasswordMutation = useResetUserPassword();

  const users = data?.data ?? [];

  const userFormSchema = useMemo(() => {
    return z.object({
      name: z
        .string()
        .trim()
        .min(3, "Full name must contain at least 3 characters")
        .max(255, "Full name must be less than 255 characters"),
      email: z
        .string()
        .trim()
        .email("Please enter a valid email address")
        .transform((val) => val.toLowerCase()),
      phone: indiaPhoneSchema,
      password: z
        .string()
        .optional()
        .refine(
          (val) => {
            if (modalMode === "create") {
              return typeof val === "string" && val.length >= 8 && val.length <= 100;
            }
            return true;
          },
          { message: "Password must contain at least 8 characters" }
        ),
      roleId: z
        .union([z.number().int().positive("Please select a valid role"), z.nan()])
        .optional()
        .transform((val) => (typeof val === "number" && !isNaN(val) ? val : undefined)),
      status: z.enum(["active", "inactive", "banned"]).optional(),
    }).superRefine((data, ctx) => {
      if (modalMode === "create" && (!data.password || data.password.length < 8)) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["password"],
    message: "Password must contain at least 8 characters",
  });
}
    });
  }, [modalMode]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      roleId: undefined,
      status: "active",
    },
  });

  const {
    register: registerResetPassword,
    handleSubmit: handleSubmitResetPassword,
    reset: resetResetPassword,
    formState: { errors: resetPasswordErrors },
  } = useForm<{ password: string }>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { password: "" },
  });

  useEffect(() => {
    if (modalMode === "edit" && selectedUser) {
      reset({
        name: selectedUser.name,
        email: selectedUser.email ?? "",
        password: "",
        phone: selectedUser.phone ?? "",
        roleId: selectedUser.roleId,
        status: (selectedUser.status as "active" | "inactive" | "banned") || "active",
      });
    } else if (modalMode === "create") {
      reset({
        name: "",
        email: "",
        password: "",
        phone: "",
        roleId: undefined,
        status: "active",
      });
    }
  }, [modalMode, selectedUser, reset]);

  const onSubmit = async (formData: UserFormValues) => {
    if (modalMode === "edit" && selectedUser) {
      try {
        const { password: _, ...updateData } = formData;
        await updateMutation.mutateAsync({ id: selectedUser.id, data: updateData });
        toast.success("User updated successfully", `"${formData.name}" was saved.`);
        setModalMode(null);
        setSelectedUser(null);
      } catch (err: any) {
        toast.error("Failed to update user", err?.message || "Please try again.");
      }
    } else if (modalMode === "create") {
      try {
        await createMutation.mutateAsync(formData as CreateUserSchemaInput);
        toast.success("User created", `"${formData.name}" was added successfully.`);
        setModalMode(null);
        reset();
      } catch (err: any) {
        toast.error("Failed to create user", err?.message || "Please try again.");
      }
    }
  };

  const onSubmitResetPassword = async (formData: { password: string }) => {
    if (selectedUser) {
      try {
        await resetPasswordMutation.mutateAsync({ id: selectedUser.id, password: formData.password });
        toast.success("Password reset", `Password for "${selectedUser.name}" was updated successfully.`);
        setModalMode(null);
        setSelectedUser(null);
        resetResetPassword();
      } catch (err: any) {
        toast.error("Failed to reset password", err?.message || "Please try again.");
      }
    }
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    reset();
    resetResetPassword();
  };

  const columns: ColumnDef<UserListItem, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name & Email",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.original.phone;
        if (!phone) return "-";
        return phone.replace(/^\+91/, "");
      },
    },
     {
      accessorKey: "roleName",
      header: "Role",
      cell: ({ row }) => {
        const role = row.original.roleName || "Unknown";
        return (
          <Badge
            variant="outline"
            className={cn(roleColors[role.toUpperCase()] ?? "!bg-gray-100 !text-gray-700 !border-gray-300")}
          >
            {role}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
  const status = row.original.status?.toLowerCase();
  return (
    <Badge
      variant={statusBadgeVariant(row.original.status) as "success" | "secondary" | "destructive"}
      className={cn(
  status === "inactive" && "!bg-red-100 !text-red-700",
  status === "banned" && "!bg-red-200 !text-red-800"
)}
    >
      {row.original.status}
    </Badge>
  );
},
    },
    {
      accessorKey: "createdAt",
      header: "Joined",
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
            onClick={() => {
              setSelectedUser(row.original);
              setModalMode("edit");
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Reset Password"
            onClick={() => {
              setSelectedUser(row.original);
              setModalMode("resetPassword");
            }}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            onClick={() => setDeleteId(row.original.id)}
          >
            <Trash2 className="h-4 w-4 text-error-600" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading && !data) return <AdminTableSkeleton />;
  if (error) return <ErrorState message="Failed to load users" onRetry={() => refetch()} />;

  const isMutating = createMutation.isPending || updateMutation.isPending;
  const isRoleMutating = resetPasswordMutation.isPending;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminBreadcrumb items={[{ label: "Users" }]} />
      <AdminPageHeader
        title="Users"
        description="Manage user accounts and permissions"
        actions={
          <Button variant="gradient" onClick={() => setModalMode("create")}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        }
      />

      <AdminContent className="flex-1 min-h-0 overflow-hidden mt-4">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-xs">
          <DataTable
            columns={columns}
            data={users}
            pageSize={pageSize}
            pageSizeOptions={[10, 20, 30, 50]}
            page={data?.meta?.page ?? page}
            totalPages={
              data?.meta?.totalPages ??
              Math.max(1, Math.ceil((data?.meta?.total ?? users.length) / pageSize))
            }
            totalItems={data?.meta?.total ?? users.length}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            className="bg-white border-0"
            emptyMessage={
              search.trim() || statusFilter !== "all"
                ? "No users matched your filter criteria."
                : "No users found. Click '+ Add User' to create a new user account."
            }
          />
        </div>
      </AdminContent>

      <FormModal
        open={modalMode === "create" || modalMode === "edit"}
        onClose={handleCloseModal}
        title={modalMode === "edit" ? "Edit User" : "Add User"}
        description={modalMode === "edit" ? "Update user details" : "Create a new user account"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={handleSubmit(onSubmit)} disabled={isMutating}>
              {modalMode === "edit" ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-error-600">*</span>
            </label>
            <input
              {...register("name")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Full name"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-error-600">*</span>
            </label>
            <input
              {...register("email")}
              type="email"
              maxLength={EMAIL_MAX_LENGTH}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="user@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.email.message}</p>
            )}
          </div>

          {modalMode === "create" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-error-600">*</span>
              </label>
              <input
                {...register("password")}
                type="password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="Minimum 8 characters"
                placeholder="Minimum 8 characters"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500 font-medium">{errors.password.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-error-600">*</span>
            </label>
           <input
  {...register("phone", {
    onChange: (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    },
  })}
  type="tel"
  inputMode="numeric"
  maxLength={10}
  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
  placeholder="10-digit phone number"
/>
            {errors.phone && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.phone.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role ID
              </label>
              <input
                {...register("roleId", { valueAsNumber: true })}
                type="number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="1"
              />
              {errors.roleId && (
                <p className="mt-1 text-xs text-red-500 font-medium">{errors.roleId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select
                value={watch("status")}
                onValueChange={(val) => setValue("status", val as "active" | "inactive" | "banned", { shouldValidate: true })}
                searchable={false}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "banned", label: "Banned" },
                ]}
              />
              {errors.status && (
                <p className="mt-1 text-xs text-red-500 font-medium">{errors.status.message}</p>
              )}
            </div>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={modalMode === "resetPassword"}
        onClose={handleCloseModal}
        title="Reset Password"
        description={`Set a new password for ${selectedUser?.name ?? ""}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitResetPassword(onSubmitResetPassword)}
              disabled={isRoleMutating}
            >
              Reset Password
            </Button>
          </>
        }
      >
        <form
          onSubmit={handleSubmitResetPassword(onSubmitResetPassword)}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password <span className="text-error-600">*</span>
            </label>
            <input
              {...registerResetPassword("password")}
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Minimum 8 characters"
              placeholder="Minimum 8 characters"
            />
            {resetPasswordErrors.password && (
              <p className="mt-1 text-xs text-red-500 font-medium">
                {resetPasswordErrors.password.message}
              </p>
            )}
          </div>
        </form>
      </FormModal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            try {
              await deleteMutation.mutateAsync(deleteId);
              toast.success("User deleted", "The user was removed successfully.");
              setDeleteId(null);
            } catch (err: any) {
              toast.error("Failed to delete user", err?.message || "Please try again.");
            }
          }
        }}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
