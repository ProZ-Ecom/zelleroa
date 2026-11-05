import { cache } from "react";
import { db } from "@/lib/db/prisma";

/** The built-in owner roles. They bypass permission checks and always get everything. */
const OWNER_ROLE_SLUGS = ["admin", "super-admin", "super_admin"];

export interface RoleAccess {
  roleId: number | null;
  roleName: string | null;
  scope: string;
  /** True for the built-in owner roles: every permission, including owner-only routes. */
  isOwner: boolean;
  /** Permission names granted to the role (empty for an owner, who needs no list). */
  permissions: string[];
}

const EMPTY_ACCESS: RoleAccess = {
  roleId: null,
  roleName: null,
  scope: "CUSTOMER",
  isOwner: false,
  permissions: [],
};

/**
 * What a role may do, read from `role_permissions`.
 *
 * Wrapped in React's `cache`, so several guards in one request share a single query. The
 * session only carries the role NAME, which is unique (the Roles service rejects duplicates),
 * so that is what we look it up by — the slug is matched too for sessions issued with it.
 */
export const getRoleAccess = cache(async (roleName?: string | null): Promise<RoleAccess> => {
  if (!roleName) return EMPTY_ACCESS;

  const role = await db.role
    .findFirst({
      where: {
        OR: [{ name: roleName }, { name: roleName.toUpperCase() }, { slug: roleName.toLowerCase() }],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        scope: true,
        rolePermissions: {
          where: { is_active: true },
          select: { permission: { select: { name: true, is_active: true } } },
        },
      },
    })
    .catch(() => null);

  if (!role) return EMPTY_ACCESS;

  return {
    roleId: Number(role.id),
    roleName: role.name,
    scope: role.scope,
    isOwner: OWNER_ROLE_SLUGS.includes(role.slug.toLowerCase()),
    permissions: role.rolePermissions
      .filter((rp) => rp.permission?.is_active)
      .map((rp) => rp.permission.name),
  };
});

/** True when this role may perform `permission` (owners always may). */
export async function roleHasPermission(
  roleName: string | null | undefined,
  permission: string
): Promise<boolean> {
  const access = await getRoleAccess(roleName);
  return access.isOwner || access.permissions.includes(permission);
}

/** True for the built-in owner roles, which keep access to owner-only maintenance routes. */
export async function isOwnerRole(roleName?: string | null): Promise<boolean> {
  return (await getRoleAccess(roleName)).isOwner;
}
