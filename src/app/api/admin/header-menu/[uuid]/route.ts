import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { headerMenuService } from "@/features/header-menu/services/header-menu.service";
import {
  updateAdminHeaderMenuItemSchema,
  type UpdateAdminHeaderMenuItemInput,
} from "@/features/header-menu/validations/admin-header-menu.schema";
import { db } from "@/lib/db/prisma";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const rawRole = (context.session?.user as { role?: string })?.role;
      const userRole = rawRole?.toUpperCase();
      if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
        const hasPermission = await db.rolePermission.findFirst({
          where: {
            role: {
              OR: [
                ...(userRole ? [{ name: userRole }] : []),
                ...(rawRole ? [{ name: rawRole }, { slug: rawRole.toLowerCase() }] : []),
              ],
            },
            permission: {
              OR: [
                { name: "HEADER_MENU_VIEW" },
                { slug: "header-menu-view" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Header menu item UUID is required");
      }

      const item = await headerMenuService.getAdminHeaderMenuItemByUuid(uuid);
      return apiSuccess(item, "Header menu item fetched successfully");
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const rawRole = (context.session?.user as { role?: string })?.role;
      const userRole = rawRole?.toUpperCase();
      if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
        const hasPermission = await db.rolePermission.findFirst({
          where: {
            role: {
              OR: [
                ...(userRole ? [{ name: userRole }] : []),
                ...(rawRole ? [{ name: rawRole }, { slug: rawRole.toLowerCase() }] : []),
              ],
            },
            permission: {
              OR: [
                { name: "HEADER_MENU_UPDATE" },
                { slug: "header-menu-update" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Header menu item UUID is required");
      }

      const body = context.body as UpdateAdminHeaderMenuItemInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const item = await headerMenuService.updateAdminHeaderMenuItem(uuid, body, adminEmail);
      return apiSuccess(item, "Header menu item updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateAdminHeaderMenuItemSchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const rawRole = (context.session?.user as { role?: string })?.role;
      const userRole = rawRole?.toUpperCase();
      if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
        const hasPermission = await db.rolePermission.findFirst({
          where: {
            role: {
              OR: [
                ...(userRole ? [{ name: userRole }] : []),
                ...(rawRole ? [{ name: rawRole }, { slug: rawRole.toLowerCase() }] : []),
              ],
            },
            permission: {
              OR: [
                { name: "HEADER_MENU_DELETE" },
                { slug: "header-menu-delete" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Header menu item UUID is required");
      }

      const adminEmail = context.session?.user?.email ?? undefined;
      const result = await headerMenuService.deleteAdminHeaderMenuItem(uuid, adminEmail);

      return apiSuccess(null, result.message);
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);
