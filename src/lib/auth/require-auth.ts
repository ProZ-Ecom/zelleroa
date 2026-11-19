import { cookies } from "next/headers";
import { auth } from "./config";
import { redirect } from "next/navigation";
import { verifyAccessToken } from "./jwt";
import { ROLES } from "@/lib/constants";
import { isRoleAllowed, resolveRoleScope } from "./role-routes";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }
  return session;
}

/** Any role in the ADMIN scope, including roles an admin created themselves. */
export async function requireAdmin() {
  const session = await requireAuth();
  if (sessionScope(session) !== "ADMIN") {
    redirect("/unauthorized");
  }
  return session;
}

export async function requireCustomer() {
  const session = await requireAuth();
  if (sessionScope(session) !== "CUSTOMER") {
    redirect("/unauthorized");
  }
  return session;
}

export async function requireAgent() {
  const session = await requireAuth();
  if (sessionScope(session) !== "AGENT") {
    redirect("/unauthorized");
  }
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();
  if (!isRoleAllowed(roles, session.user.role, session.user.scope)) {
    redirect("/unauthorized");
  }
  return session;
}

export async function requirePermission(permission: string) {
  const session = await requireAuth();

  // Permission-level checks land here next (Phase 1); for now any ADMIN-scope role passes.
  if (sessionScope(session) !== "ADMIN") {
    redirect("/unauthorized");
  }

  return session;
}

export async function getOptionalSession() {
  return await auth();
}

/**
 * Resolves the signed-in user inside a Server Component, covering both auth
 * mechanisms this app uses: a NextAuth session (Google / NextAuth credentials)
 * and the HttpOnly `access_token` cookie issued by the custom login. Mirrors
 * what `createApiHandler` does for API routes.
 */
export async function getPageSessionUser(): Promise<{
  id: string;
  email?: string;
  role: string;
  scope: string;
} | null> {
  try {
    const session = await auth();
    const user = session?.user as
      | { id?: string; email?: string; role?: string; scope?: string }
      | undefined;
    if (user?.id) {
      const role = user.role || ROLES.CUSTOMER;
      return {
        id: user.id,
        email: user.email,
        role,
        scope: resolveRoleScope(user.scope, role),
      };
    }
  } catch {
    // Fall through to the access-token cookie.
  }

  try {
    const token = (await cookies()).get("access_token")?.value;
    if (!token) return null;
    const payload = verifyAccessToken(token);
    const role = payload.role || ROLES.CUSTOMER;
    return {
      id: payload.userId,
      email: payload.email,
      role,
      scope: resolveRoleScope(payload.scope, role),
    };
  } catch {
    return null;
  }
}

/** Scope of the signed-in user: from the session when present, else mapped from the role name. */
function sessionScope(session: { user?: { role?: string; scope?: string } } | null): string {
  return resolveRoleScope(session?.user?.scope, session?.user?.role);
}

export function isAdmin(session: { user?: { role?: string; scope?: string } } | null): boolean {
  return !!session?.user?.role && sessionScope(session) === "ADMIN";
}

export function isCustomer(session: { user?: { role?: string; scope?: string } } | null): boolean {
  return !!session?.user?.role && sessionScope(session) === "CUSTOMER";
}

export function isAgent(session: { user?: { role?: string; scope?: string } } | null): boolean {
  return !!session?.user?.role && sessionScope(session) === "AGENT";
}

export function isAuthenticated(session: { user?: { id?: string } } | null): boolean {
  return !!session?.user?.id;
}
