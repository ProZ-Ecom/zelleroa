import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess} from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { productService } from "@/features/products/services/product.service";
import {
  updateAdminProductSchema,
  type UpdateAdminProductInput,
} from "@/features/products/validations/admin-product.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Product UUID is required");
      }

      const product = await productService.getAdminProductByUuid(uuid);
      return apiSuccess(product, "Product fetched successfully");
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
        throw ApiError.badRequest("Product UUID is required");
      }

      const body = context.body as UpdateAdminProductInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const product = await productService.updateAdminProduct(uuid, body, adminEmail);
      return apiSuccess(product, "Product updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateAdminProductSchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Product UUID is required");
      }

      const adminEmail = context.session?.user?.email ?? undefined;
      const result = await productService.deleteAdminProduct(uuid, adminEmail);

      return apiSuccess(null, result.message);
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);
