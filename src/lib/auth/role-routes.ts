/** Edge-safe role -> landing route mapping, shared by middleware, login and the header. */
export function getRoleHome(role?: string | null): string {
  if (role === "ADMIN" || role === "STAFF") return "/admin/dashboard";
  if (role === "AGENT") return "/agent/dashboard";
  return "/account/dashboard";
}

/** Only same-origin relative paths may be used as post-login destinations. */
export function isSafeCallbackUrl(url?: string | null): url is string {
  return !!url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\");
}

/** True when `path` is inside the area owned by `role` (so a callbackUrl is acceptable for it). */
export function isPathAllowedForRole(path: string, role?: string | null): boolean {
  const inArea = (base: string) => path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`);
  if (inArea("/admin")) return role === "ADMIN" || role === "STAFF";
  if (inArea("/agent")) return role === "AGENT";
  if (inArea("/account") || inArea("/profile")) return role === "CUSTOMER";
  if (inArea("/orders") || inArea("/wishlist")) return role === "CUSTOMER" || role === "AGENT";
  return true;
}

/** Post-login destination: honour callbackUrl only if this role may open it, else the role's dashboard. */
export function resolvePostLoginTarget(role: string | undefined, callbackUrl?: string | null): string {
  if (isSafeCallbackUrl(callbackUrl) && callbackUrl !== "/" && isPathAllowedForRole(callbackUrl, role)) {
    return callbackUrl;
  }
  return getRoleHome(role);
}
