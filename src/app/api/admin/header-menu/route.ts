import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated, apiError } from "@/lib/api/api-response";
import { headerMenuService } from "@/features/header-menu/services/header-menu.service";
import {
  createAdminHeaderMenuItemSchema,
  adminHeaderMenuQuerySchema,
  type CreateAdminHeaderMenuItemInput,
  type AdminHeaderMenuQueryInput,
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

      const query = context.query as AdminHeaderMenuQueryInput;
      const result = await headerMenuService.getAdminHeaderMenuItems({
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 50,
        search: query?.search,
      });

      return apiSuccess(result.data, "Header menu items fetched successfully", 200, result.meta);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    querySchema: adminHeaderMenuQuerySchema,
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
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
                { name: "HEADER_MENU_CREATE" },
                { slug: "header-menu-create" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const body = context.body as CreateAdminHeaderMenuItemInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const item = await headerMenuService.createAdminHeaderMenuItem(body, adminEmail);

      return apiCreated(item, "Header menu item created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: createAdminHeaderMenuItemSchema,
  }
);
