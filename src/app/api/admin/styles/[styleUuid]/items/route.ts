import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { itemService } from "@/features/items/services/item.service";
import {
  createAdminItemSchema,
  adminItemListQuerySchema,
  type CreateAdminItemInput,
  type AdminItemListQueryInput,
} from "@/features/items/validations/admin-item.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const styleUuid = context.params?.styleUuid;
      if (!styleUuid) {
        throw ApiError.badRequest("Style UUID is required");
      }

      const query = context.query as AdminItemListQueryInput;
      const result = await itemService.getAdminItems(styleUuid, {
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
        search: query?.search,
        isActive: query?.isActive,
      });

      return apiSuccess(result.data, "Items fetched successfully", 200, result.meta);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    querySchema: adminItemListQuerySchema,
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const styleUuid = context.params?.styleUuid;
      if (!styleUuid) {
        throw ApiError.badRequest("Style UUID is required");
      }

      const body = context.body as CreateAdminItemInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const item = await itemService.createAdminItem(styleUuid, body, adminEmail);

      return apiCreated(item, "Item created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: createAdminItemSchema,
  }
);
