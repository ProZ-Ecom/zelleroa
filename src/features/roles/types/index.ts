export interface RoleListItem {
  id: number;
  name: string;
  description: string | null;
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
