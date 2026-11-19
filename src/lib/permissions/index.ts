/**
 * Permission helpers. The list of permissions itself lives in `./catalog`, which is also
 * what the seed writes to the database and what the Roles screen renders.
 */
export {
  PERMISSION_MODULES,
  ALL_PERMISSIONS,
  PERMISSIONS,
  type PermissionDefinition,
  type PermissionModuleDefinition,
  type PermissionName,
} from "./catalog";

export { resolveRequiredPermission, OWNER_ONLY } from "./api-map";

export function hasPermission(userPermissions: string[], permission: string): boolean {
  return userPermissions.includes(permission);
}

export function hasAnyPermission(userPermissions: string[], permissions: string[]): boolean {
  return permissions.some((p) => userPermissions.includes(p));
}

export function hasAllPermissions(userPermissions: string[], permissions: string[]): boolean {
  return permissions.every((p) => userPermissions.includes(p));
}
