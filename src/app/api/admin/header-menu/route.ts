import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { headerMenuService } from "@/features/header-menu/services/header-menu.service";
import {
  createAdminHeaderMenuItemSchema,
  adminHeaderMenuQuerySchema,
  type CreateAdminHeaderMenuItemInput,
  type AdminHeaderMenuQueryInput,
} from "@/features/header-menu/validations/admin-header-menu.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
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
    requiredRole: ["ADMIN"],
    querySchema: adminHeaderMenuQuerySchema,
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as CreateAdminHeaderMenuItemInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const item = await headerMenuService.createAdminHeaderMenuItem(body, adminEmail);

      return apiCreated(item, "Header menu item created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: createAdminHeaderMenuItemSchema,
  }
);
