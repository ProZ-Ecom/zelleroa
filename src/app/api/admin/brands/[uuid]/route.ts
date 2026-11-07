import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess} from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { brandService } from "@/features/brands/services/brand.service";
import {
  updateAdminBrandSchema,
  type UpdateAdminBrandInput,
} from "@/features/brands/validations/admin-brand.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Brand UUID is required");
      }

      const brand = await brandService.getAdminBrandByUuid(uuid);
      return apiSuccess(brand, "Brand fetched successfully");
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
      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Brand UUID is required");
      }

      const body = context.body as UpdateAdminBrandInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const brand = await brandService.updateAdminBrand(uuid, body, adminEmail);
      return apiSuccess(brand, "Brand updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateAdminBrandSchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Brand UUID is required");
      }

      const adminEmail = context.session?.user?.email ?? undefined;
      const result = await brandService.deleteAdminBrand(uuid, adminEmail);

      return apiSuccess(null, result.message);
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);
