"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { apiClient } from "@/lib/api/api-client";
import { actionPermissionForAdminPath } from "@/lib/permissions/admin-routes";

export interface AdminAccess {
  role: string | null;
  scope: string;
  /** The built-in admin account: every permission, nothing hidden. */
  isOwner: boolean;
  permissions: string[];
}

const EMPTY: AdminAccess = { role: null, scope: "ADMIN", isOwner: false, permissions: [] };

const AdminAccessContext = React.createContext<{ access: AdminAccess; loading: boolean }>({
  access: EMPTY,
  loading: true,
});

async function fetchAdminAccess(): Promise<AdminAccess> {
  const response = await apiClient.get<AdminAccess>("/api/admin/me/access");
  return response.data ?? EMPTY;
}

/**
 * Makes the signed-in admin's permissions available to the whole admin area.
 *
 * `initialAccess` comes from the dashboard layout on the server, so the first paint already
 * knows what to show and the sidebar never flashes links the role cannot open. The query
 * then keeps it fresh (after a role edit, say).
 */
export function AdminAccessProvider({
  initialAccess,
  children,
}: {
  initialAccess?: AdminAccess;
  children: React.ReactNode;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "me", "access"],
    queryFn: fetchAdminAccess,
    initialData: initialAccess,
    staleTime: 60 * 1000,
  });

  const value = React.useMemo(
    () => ({ access: data ?? initialAccess ?? EMPTY, loading: !data && isLoading }),
    [data, initialAccess, isLoading]
  );

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

/** The signed-in admin's role, scope and permissions. */
export function useAdminAccess() {
  return React.useContext(AdminAccessContext);
}

/**
 * True when the signed-in admin holds the permission (owners always do). With several
 * permissions it is true when any of them is held, which is what a screen with more than
 * one way in needs.
 */
export function useCan(permission?: string | string[] | null): boolean {
  const { access } = useAdminAccess();
  if (!permission) return true;
  if (access.isOwner) return true;
  const wanted = Array.isArray(permission) ? permission : [permission];
  return wanted.some((name) => access.permissions.includes(name));
}

/**
 * True when the role may perform `action` (CREATE / UPDATE / DELETE / APPROVE / …) on the
 * screen currently open. The permission is derived from the route, so a page does not have
 * to name it: on /admin/dashboard/brands, `useScreenCan("CREATE")` asks for BRAND_CREATE.
 */
export function useScreenCan(action: string): boolean {
  const pathname = usePathname();
  const required = actionPermissionForAdminPath(pathname, action);
  return useCan(required);
}

/**
 * Renders its children only when the role may perform `action` on the current screen.
 *
 * ```tsx
 * <CanAct action="CREATE">
 *   <Button onClick={openCreate}>Add brand</Button>
 * </CanAct>
 * ```
 */
export function CanAct({
  action,
  fallback = null,
  children,
}: {
  action: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  return useScreenCan(action) ? <>{children}</> : <>{fallback}</>;
}

/**
 * Renders its children only for a role that holds the permission.
 *
 * ```tsx
 * <Can permission="PRODUCT_CREATE">
 *   <Button onClick={openCreate}>Add product</Button>
 * </Can>
 * ```
 */
export function Can({
  permission,
  fallback = null,
  children,
}: {
  permission?: string | string[] | null;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  return useCan(permission) ? <>{children}</> : <>{fallback}</>;
}
