"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  usePermissions,
  useCreatePermission,
  useUpdatePermission,
  useDeletePermission,
} from "@/features/roles/hooks";
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
import {
  createPermissionSchema,
  type CreatePermissionSchemaInput,
} from "@/features/roles/validations/role.schema";
import type { ColumnDef } from "@tanstack/react-table";
import type { PermissionListItem } from "@/features/roles/types";

export default function AdminPermissionsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<PermissionListItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: permissionsData, isLoading, error, refetch } = usePermissions();
  const createMutation = useCreatePermission();
  const updateMutation = useUpdatePermission();
  const deleteMutation = useDeletePermission();

  const permissions = permissionsData ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePermissionSchemaInput>({
    resolver: zodResolver(createPermissionSchema),
    defaultValues: {
      name: "",
      module: "",
      description: "",
    },
  });

  useEffect(() => {
    if (editingPermission) {
      reset({
        name: editingPermission.name,
        module: editingPermission.module,
        description: editingPermission.description ?? "",
      });
    } else {
      reset({ name: "", module: "", description: "" });
    }
  }, [editingPermission, reset]);

  const onSubmit = (formData: CreatePermissionSchemaInput) => {
    if (editingPermission) {
      updateMutation.mutate(
        { id: editingPermission.id, data: formData },
        {
          onSuccess: () => {
            setModalOpen(false);
            setEditingPermission(null);
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

  const handleOpenModal = (permission?: PermissionListItem) => {
    if (permission) {
      setEditingPermission(permission);
    } else {
      setEditingPermission(null);
    }
    setModalOpen(true);
  };

  const columns: ColumnDef<PermissionListItem, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <p className="font-medium">{row.original.name}</p>,
    },
    {
      accessorKey: "module",
      header: "Module",
      cell: ({ row }) => <Badge variant="info">{row.original.module}</Badge>,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => row.original.description || "-",
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

  if (isLoading) return <AdminTableSkeleton />;
  if (error) return <ErrorState message="Failed to load permissions" onRetry={() => refetch()} />;

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminBreadcrumb items={[{ label: "Permissions" }]} />
      <AdminPageHeader
        title="Permissions"
        description="Manage granular permissions for roles"
        actions={
          <Button variant="gradient" onClick={() => handleOpenModal()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Permission
          </Button>
        }
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <DataTable
            columns={columns}
            data={permissions}
            searchKey="name"
            searchPlaceholder="Search permissions..."
            pageSize={20}
            className="bg-white border border-neutral-200"
          />
        </div>
      </AdminContent>

      <FormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPermission(null);
        }}
        title={editingPermission ? "Edit Permission" : "Add Permission"}
        description={
          editingPermission
            ? "Update permission details"
            : "Create a new permission"
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setEditingPermission(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="gradient" onClick={handleSubmit(onSubmit)} disabled={isMutating}>
              {editingPermission ? "Update" : "Create"}
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
              placeholder="e.g. products.create"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Module <span className="text-error-600">*</span>
            </label>
            <input
              {...register("module")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="e.g. products"
            />
            {errors.module && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.module.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              {...register("description")}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Permission description"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.description.message}</p>
            )}
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
        title="Delete Permission"
        description="Are you sure you want to delete this permission? Roles using it will lose access."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
