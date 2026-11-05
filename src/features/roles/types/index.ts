import type { RoleScope } from "@/lib/auth/role-routes";

export interface RoleListItem {
  id: number;
  name: string;
  slug?: string;
  description: string | null;
  /** Area the role belongs to: "ADMIN" | "AGENT" | "CUSTOMER". */
  scope?: RoleScope;
  _count?: {
    users?: number;
    rolePermissions?: number;
  };
}

export interface RoleRef {
  id: number;
  name: string;
}

export interface PermissionListItem {
  id: number;
  name: string;
  description: string | null;
  module: string;
  roleIds?: number[];
  roles?: RoleRef[];
}

export interface RoleDetail extends RoleListItem {
  permissions: PermissionListItem[];
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  scope?: RoleScope;
  permissionIds?: number[];
}

export interface UpdateRoleInput extends Partial<CreateRoleInput> {}

export interface CreatePermissionInput {
  name: string;
  description?: string;
  module: string;
  roleIds?: number[];
}

export interface UpdatePermissionInput extends Partial<CreatePermissionInput> {}
