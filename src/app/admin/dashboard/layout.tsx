import { AdminLayout } from "@/components/admin";
import { AdminAccessProvider } from "@/features/access";
import { AdminPageGuard } from "@/features/access/admin-page-guard";
import { getPageSessionUser } from "@/lib/auth/require-auth";
import { getRoleAccess } from "@/lib/permissions/server";

/**
 * Resolves the signed-in admin's permissions on the server and hands them to the admin UI,
 * so the sidebar and the page guard know what this role may open on the first paint.
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await getPageSessionUser();
  const access = await getRoleAccess(sessionUser?.role);

  return (
    <AdminAccessProvider
      initialAccess={{
        role: access.roleName ?? sessionUser?.role ?? null,
        scope: access.scope,
        isOwner: access.isOwner,
        permissions: access.permissions,
      }}
    >
      <AdminLayout>
        <AdminPageGuard>{children}</AdminPageGuard>
      </AdminLayout>
    </AdminAccessProvider>
  );
}
