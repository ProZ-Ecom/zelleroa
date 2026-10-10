"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/Toast";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  usePermissions,
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
  createRoleSchema,
  type CreateRoleSchemaInput,
} from "@/features/roles/validations/role.schema";
import type { ColumnDef } from "@tanstack/react-table";
import type { RoleListItem } from "@/features/roles/types";

export default function AdminRolesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleListItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);

  const { data: rolesData, isLoading: rolesLoading, error: rolesError, refetch } = useRoles();
  const { data: permissions } = usePermissions();
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const deleteMutation = useDeleteRole();

  const roles = rolesData ?? [];

  const permissionsByModule = useMemo(() => {
    if (!permissions) return {};
    const grouped: Record<string, typeof permissions> = {};
    for (const perm of permissions) {
      if (!grouped[perm.module]) grouped[perm.module] = [];
      grouped[perm.module].push(perm);
    }
    return grouped;
  }, [permissions]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRoleSchemaInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (editingRole) {
      reset({
        name: editingRole.name,
        description: editingRole.description ?? "",
      });
    } else {
      reset({ name: "", description: "" });
    }
  }, [editingRole, reset]);

  const handleTogglePermission = (permId: number) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const onSubmit = async (formData: CreateRoleSchemaInput) => {
    const payload = { ...formData, permissionIds: selectedPermissionIds };

    if (editingRole) {
      try {
        await updateMutation.mutateAsync({ id: editingRole.id, data: payload });
        toast.success("Role updated", `"${formData.name}" was updated successfully.`);
        setModalOpen(false);
        setEditingRole(null);
        setSelectedPermissionIds([]);
      } catch (err: any) {
        toast.error("Failed to update role", err?.message || "Please try again.");
      }
    } else {
      try {
        await createMutation.mutateAsync(payload);
        toast.success("Role created", `"${formData.name}" was created successfully.`);
        setModalOpen(false);
        reset();
        setSelectedPermissionIds([]);
      } catch (err: any) {
        toast.error("Failed to create role", err?.message || "Please try again.");
      }
    }
  };

  const handleOpenModal = (role?: RoleListItem) => {
    if (role) {
      setEditingRole(role);
    } else {
      setEditingRole(null);
    }
    setSelectedPermissionIds([]);
    setModalOpen(true);
  };

  const columns: ColumnDef<RoleListItem, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <p className="font-medium">{row.original.name}</p>,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => row.original.description || "-",
    },
    {
      accessorKey: "_count.users",
      header: "Users",
      cell: ({ row }) => row.original._count?.users ?? 0,
    },
    {
      accessorKey: "_count.rolePermissions",
      header: "Permissions",
      cell: ({ row }) => row.original._count?.rolePermissions ?? 0,
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

  if (rolesLoading) return <AdminTableSkeleton />;
  if (rolesError) return <ErrorState message="Failed to load roles" onRetry={() => refetch()} />;

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminBreadcrumb items={[{ label: "Roles" }]} />
      <AdminPageHeader
        title="Roles"
        description="Manage user roles and their permissions"
        actions={
          <Button variant="gradient" onClick={() => handleOpenModal()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
        }
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <DataTable
            columns={columns}
            data={roles}
            searchKey="name"
            searchPlaceholder="Search roles..."
            pageSize={20}
            className="bg-white border border-neutral-200"
          />
        </div>
      </AdminContent>

      <FormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingRole(null);
          setSelectedPermissionIds([]);
        }}
        title={editingRole ? "Edit Role" : "Add Role"}
        description={editingRole ? "Update role details and permissions" : "Create a new role"}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setEditingRole(null);
                setSelectedPermissionIds([]);
              }}
            >
              Cancel
            </Button>
            <Button variant="gradient" onClick={handleSubmit(onSubmit)} disabled={isMutating}>
              {editingRole ? "Update" : "Create"}
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
              placeholder="Role name"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>
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
              placeholder="Role description"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 p-4 space-y-4">
              {Object.keys(permissionsByModule).length === 0 && (
                <p className="text-sm text-muted-foreground">No permissions available</p>
              )}
              {Object.entries(permissionsByModule).map(([module, perms]) => (
                <div key={module}>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    {module}
                  </p>
                  <div className="space-y-1">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-center gap-2 cursor-pointer rounded p-1 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissionIds.includes(perm.id)}
                          onChange={() => handleTogglePermission(perm.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm">{perm.name}</span>
                        {perm.description && (
                          <span className="text-xs text-muted-foreground">
                            - {perm.description}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
              toast.success("Role deleted", "The role was removed successfully.");
              setDeleteId(null);
            } catch (err: any) {
              toast.error("Failed to delete role", err?.message || "Please try again.");
            }
          }
        }}
        title="Delete Role"
        description="Are you sure you want to delete this role? Users with this role will lose their permissions."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
