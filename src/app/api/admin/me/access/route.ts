import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { getRoleAccess } from "@/lib/permissions/server";

/**
 * The signed-in admin user's own role and permissions, used by the admin UI to hide links
 * and buttons it may not use. Needs no permission of its own — everyone in the admin area
 * may read what they themselves can do.
 */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUser = context.session?.user as { role?: string; scope?: string } | undefined;
      const access = await getRoleAccess(sessionUser?.role);

      return apiSuccess(
        {
          role: access.roleName ?? sessionUser?.role ?? null,
          scope: access.scope,
          isOwner: access.isOwner,
          permissions: access.permissions,
        },
        "Access fetched successfully"
      );
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: false,
  }
);
