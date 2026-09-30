"use client";

import { useState, useEffect } from "react";
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
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import {
  createUserSchema,
  resetPasswordSchema,
  type CreateUserSchemaInput,
} from "@/features/users/validations/user.schema";
import type { ColumnDef } from "@tanstack/react-table";
import type { UserListItem } from "@/features/users/types";

type ModalMode = "create" | "edit" | "resetPassword" | null;

export default function AdminUsersPage() {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | number | null>(null);

  const { data, isLoading, error, refetch } = useUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const resetPasswordMutation = useResetUserPassword();

  const users = data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateUserSchemaInput>({
    resolver: zodResolver(createUserSchema),
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

  const onSubmit = async (formData: CreateUserSchemaInput) => {
    if (modalMode === "edit" && selectedUser) {
      try {
        const { password: _, ...updateData } = formData;
        await updateMutation.mutateAsync({ id: selectedUser.id, data: updateData });
        toast.success("User updated", `"${formData.name}" was updated successfully.`);
        setModalMode(null);
        setSelectedUser(null);
      } catch (err: any) {
        toast.error("Failed to update user", err?.message || "Please try again.");
      }
    } else if (modalMode === "create") {
      try {
        await createMutation.mutateAsync(formData);
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

  const statusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "success";
      case "inactive":
        return "secondary";
      case "banned":
      case "blocked":
        return "destructive";
      default:
        return "secondary";
    }
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
      cell: ({ row }) => row.original.phone || "-",
    },
    {
      accessorKey: "roleName",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.roleName || "Unknown"}</Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant(row.original.status) as "success" | "secondary" | "destructive"}>
          {row.original.status}
        </Badge>
      ),
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

  if (isLoading) return <AdminTableSkeleton />;
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
          <Button onClick={() => setModalMode("create")}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        }
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <DataTable
            columns={columns}
            data={users}
            searchKey="name"
            searchPlaceholder="Search users..."
            pageSize={20}
            className="bg-white border border-neutral-200"
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
            <Button onClick={handleSubmit(onSubmit)} disabled={isMutating}>
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
                placeholder="Minimum 6 characters"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500 font-medium">{errors.password.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              {...register("phone")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Phone number"
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
              placeholder="Minimum 6 characters"
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
