/** Edge-safe role -> landing route mapping, shared by middleware, login and the header. */

/** The three areas of the app a role can belong to. A role's `scope` column, never its name. */
export const ROLE_SCOPES = ["ADMIN", "AGENT", "CUSTOMER"] as const;
export type RoleScope = (typeof ROLE_SCOPES)[number];

export function isRoleScope(value: unknown): value is RoleScope {
  return typeof value === "string" && (ROLE_SCOPES as readonly string[]).includes(value);
}

/**
 * Scope for the four roles that shipped before `roles.scope` existed. Only a fallback for
 * sessions/tokens issued before this change — new tokens carry the scope from the database.
 */
export function legacyScopeForRoleName(role?: string | null): RoleScope {
  const name = role?.toUpperCase();
  if (name === "ADMIN" || name === "SUPER_ADMIN" || name === "STAFF") return "ADMIN";
  if (name === "AGENT") return "AGENT";
  return "CUSTOMER";
}

/** The scope to act on: what the token says, else the legacy mapping from the role name. */
export function resolveRoleScope(scope?: string | null, role?: string | null): RoleScope {
  return isRoleScope(scope) ? scope : legacyScopeForRoleName(role);
}

/** Landing route for a signed-in user. Pass the scope when you have it; the name is the fallback. */
export function getRoleHome(role?: string | null, scope?: string | null): string {
  switch (resolveRoleScope(scope, role)) {
    case "ADMIN":
      return "/admin/dashboard";
    case "AGENT":
      return "/agent/dashboard";
    default:
      return "/account/dashboard";
  }
}

/** Only same-origin relative paths may be used as post-login destinations. */
export function isSafeCallbackUrl(url?: string | null): url is string {
  return !!url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\");
}

/** True when `path` is inside the area owned by this role (so a callbackUrl is acceptable for it). */
export function isPathAllowedForRole(path: string, role?: string | null, scope?: string | null): boolean {
  const inArea = (base: string) => path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`);
  const roleScope = resolveRoleScope(scope, role);
  if (inArea("/admin")) return roleScope === "ADMIN";
  if (inArea("/agent")) return roleScope === "AGENT";
  if (inArea("/account") || inArea("/profile")) return roleScope === "CUSTOMER";
  if (inArea("/orders") || inArea("/wishlist")) return roleScope === "CUSTOMER" || roleScope === "AGENT";
  return true;
}

/** Post-login destination: honour callbackUrl only if this role may open it, else the role's dashboard. */
export function resolvePostLoginTarget(
  role: string | undefined,
  callbackUrl?: string | null,
  scope?: string | null
): string {
  if (isSafeCallbackUrl(callbackUrl) && callbackUrl !== "/" && isPathAllowedForRole(callbackUrl, role, scope)) {
    return callbackUrl;
  }
  return getRoleHome(role, scope);
}

/**
 * Role guard for routes declared with `requiredRole: ["ADMIN", "STAFF"]` and friends.
 *
 * The role NAME still matches as before, so nothing that worked stops working. On top of
 * that, any role whose scope matches the scope those names stand for is accepted — which is
 * what lets an admin add their own back-office role (e.g. "Warehouse Manager", scope ADMIN)
 * without every route having to list it. What that role may actually touch is decided by its
 * permissions, not by this check.
 */
export function isRoleAllowed(
  requiredRoles: string[],
  role?: string | null,
  scope?: string | null
): boolean {
  if (requiredRoles.length === 0) return true;
  if (role && requiredRoles.includes(role)) return true;

  const userScope = resolveRoleScope(scope, role);
  return requiredRoles.some((required) => legacyScopeForRoleName(required) === userScope);
}
