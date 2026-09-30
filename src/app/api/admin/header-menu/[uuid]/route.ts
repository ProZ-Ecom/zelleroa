import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { headerMenuService } from "@/features/header-menu/services/header-menu.service";
import {
  updateAdminHeaderMenuItemSchema,
  type UpdateAdminHeaderMenuItemInput,
} from "@/features/header-menu/validations/admin-header-menu.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
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
    requiredRole: ["ADMIN"],
  }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
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
    requiredRole: ["ADMIN"],
    bodySchema: updateAdminHeaderMenuItemSchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
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
    requiredRole: ["ADMIN"],
  }
);
