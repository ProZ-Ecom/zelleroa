import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { itemService } from "@/features/items/services/item.service";
import {
  updateAdminItemSchema,
  type UpdateAdminItemInput,
} from "@/features/items/validations/admin-item.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const styleUuid = context.params?.styleUuid;
      const itemUuid = context.params?.itemUuid;
      if (!styleUuid || !itemUuid) {
        throw ApiError.badRequest("Style UUID and Item UUID are required");
      }

      const item = await itemService.getAdminItemByUuid(styleUuid, itemUuid);
      return apiSuccess(item, "Item fetched successfully");
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
      const styleUuid = context.params?.styleUuid;
      const itemUuid = context.params?.itemUuid;
      if (!styleUuid || !itemUuid) {
        throw ApiError.badRequest("Style UUID and Item UUID are required");
      }

      const body = context.body as UpdateAdminItemInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const item = await itemService.updateAdminItem(styleUuid, itemUuid, body, adminEmail);

      return apiSuccess(item, "Item updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: updateAdminItemSchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const styleUuid = context.params?.styleUuid;
      const itemUuid = context.params?.itemUuid;
      if (!styleUuid || !itemUuid) {
        throw ApiError.badRequest("Style UUID and Item UUID are required");
      }

      const adminEmail = context.session?.user?.email ?? undefined;
      const result = await itemService.deleteAdminItem(styleUuid, itemUuid, adminEmail);

      return apiSuccess(null, result.message);
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN"],
  }
);
