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
import { getRole } from "@/features/roles/api/get-roles";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { ExportButton } from "@/components/common/export-button";
import { exportDataToCsv } from "@/lib/export-csv";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createRoleSchema,
  type CreateRoleSchemaInput,
} from "@/features/roles/validations/role.schema";
import type { ColumnDef } from "@tanstack/react-table";
import type { RoleListItem } from "@/features/roles/types";
import { CanAct } from "@/features/access";

/** Human wording for `roles.scope` in the table and the form. */
const SCOPE_LABELS: Record<string, string> = {
  ADMIN: "Admin panel",
  AGENT: "Sales partner",
  CUSTOMER: "Customer",
};

export default function AdminRolesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleListItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");

  const queryParams = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search.trim() || undefined,
    }),
    [page, pageSize, search]
  );

  const { data: rolesResult, isLoading: rolesLoading, error: rolesError, refetch } = useRoles(queryParams);
  const { data: permissions } = usePermissions();
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const deleteMutation = useDeleteRole();

  const roles = rolesResult?.data ?? [];
  const meta = rolesResult?.meta;

  const permissionsByModule = useMemo(() => {
    if (!permissions) return {};
    const grouped: Record<string, typeof permissions> = {};
    for (const perm of permissions) {
      const moduleName = perm.module || "GENERAL";
      if (!grouped[moduleName]) grouped[moduleName] = [];
      grouped[moduleName].push(perm);
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
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      scope: "ADMIN",
    },
  });

  useEffect(() => {
    if (editingRole) {
      reset({
        name: editingRole.name,
        description: editingRole.description ?? "",
        scope: editingRole.scope ?? "ADMIN",
      });
    } else {
      reset({ name: "", description: "", scope: "ADMIN" });
    }
  }, [editingRole, reset]);

  // With 160+ permissions, ticking a whole module at once is the difference between the
  // screen being usable and not. The module checkbox shows a dash when only some are on.
  const isModuleFullySelected = (perms: { id: number | string }[]) =>
    perms.length > 0 && perms.every((p) => selectedPermissionIds.includes(Number(p.id)));

  const isModulePartiallySelected = (perms: { id: number | string }[]) =>
    perms.some((p) => selectedPermissionIds.includes(Number(p.id))) && !isModuleFullySelected(perms);

  const handleToggleModule = (perms: { id: number | string }[]) => {
    const ids = perms.map((p) => Number(p.id));
    setSelectedPermissionIds((prev) =>
      ids.every((id) => prev.includes(id))
        ? prev.filter((id) => !ids.includes(id))
        : [...prev, ...ids.filter((id) => !prev.includes(id))]
    );
  };

  const handleTogglePermission = (permId: number) => {
    const idNum = Number(permId);
    setSelectedPermissionIds((prev) =>
      prev.includes(idNum) ? prev.filter((id) => id !== idNum) : [...prev, idNum]
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

  const handleOpenModal = async (role?: RoleListItem) => {
    if (role) {
      setEditingRole(role);
      const roleIdNum = Number(role.id);
      
      // Immediately prefill permissions that already belong to this role
      const initialIds = (permissions ?? [])
        .filter((p) => p.roleIds?.some((id) => Number(id) === roleIdNum))
        .map((p) => Number(p.id));
      setSelectedPermissionIds(initialIds);
      setModalOpen(true);

      // Also fetch full role detail to guarantee complete accuracy
      try {
        const res = await getRole(roleIdNum);
        if (res.data?.permissions) {
          const freshIds = res.data.permissions.map((p: any) => Number(p.id));
          setSelectedPermissionIds(freshIds);
        }
      } catch {
        // Fallback to initialIds
      }
    } else {
      setEditingRole(null);
      setSelectedPermissionIds([]);
      setModalOpen(true);
    }
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
      accessorKey: "scope",
      header: "Access area",
      cell: ({ row }) => SCOPE_LABELS[row.original.scope ?? "CUSTOMER"] ?? row.original.scope,
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
          <CanAct action="UPDATE">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenModal(row.original)}
              title="Edit Role"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </CanAct>
          <CanAct action="DELETE">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteId(row.original.id)}
              title="Delete Role"
            >
              <Trash2 className="h-4 w-4 text-error-600" />
            </Button>
          </CanAct>
        </div>
      ),
    },
  ];

  if (rolesLoading && !rolesResult) return <AdminTableSkeleton />;
  if (rolesError) return <ErrorState message="Failed to load roles" onRetry={() => refetch()} />;

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminBreadcrumb items={[{ label: "Roles" }]} />
      <AdminPageHeader
        title="Roles"
        description="Manage user roles and their permissions"
        actions={
          <div className="flex items-center gap-2">
            <ExportButton
              onClick={() =>
                exportDataToCsv(
                  roles,
                  "roles",
                  [
                    { header: "Role Name", accessor: (r) => r.name },
                    { header: "Description", accessor: (r) => r.description || "-" },
                    { header: "Users", accessor: (r) => r._count?.users ?? 0 },
                    { header: "Permissions", accessor: (r) => r._count?.rolePermissions ?? 0 },
                  ]
                )
              }
              disabled={!roles.length}
            />
            <CanAct action="CREATE">
              <Button
                onClick={() => handleOpenModal()}
                className="h-11 rounded-xl bg-stone-900 hover:bg-stone-800 text-[#D4AF37] border border-[#D4AF37]/30 shadow-xs px-5 text-sm font-semibold transition-colors"
              >
                <Plus className="mr-2 h-4 w-4 text-[#D4AF37]" />
                Add Role
              </Button>
            </CanAct>
          </div>
        }
      />

      <AdminContent className="flex-1 min-h-0 mt-4">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-xs">
          <DataTable
            columns={columns}
            data={roles}
            pageSize={pageSize}
            pageSizeOptions={[10, 20, 30, 50]}
            page={meta?.page ?? page}
            totalPages={
              meta?.totalPages ??
              Math.max(1, Math.ceil((meta?.total ?? roles.length) / pageSize))
            }
            totalItems={meta?.total ?? roles.length}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            className="bg-white border-0"
            emptyMessage={
              search.trim()
                ? "No roles matched your search criteria."
                : "No roles found. Click '+ Add Role' to create a new role."
            }
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access area <span className="text-error-600">*</span>
            </label>
            <select
              {...register("scope")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="ADMIN">Admin panel (staff / back office)</option>
              <option value="AGENT">Sales partner portal</option>
              <option value="CUSTOMER">Customer account</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Decides which part of the site users with this role sign in to. What they can do
              inside it is set by the permissions below.
            </p>
            {errors.scope && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.scope.message}</p>
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
                  <label className="mb-2 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isModuleFullySelected(perms)}
                      ref={(el) => {
                        if (el) el.indeterminate = isModulePartiallySelected(perms);
                      }}
                      onChange={() => handleToggleModule(perms)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                    />
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {module}
                    </span>
                  </label>
                  <div className="space-y-1">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-center gap-2 cursor-pointer rounded p-1 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissionIds.includes(Number(perm.id))}
                          onChange={() => handleTogglePermission(Number(perm.id))}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                        />
                        <span className="text-sm font-medium text-neutral-800">{perm.name}</span>
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
