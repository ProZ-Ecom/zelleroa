import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { attributeService } from "@/features/attributes/services/attribute.service";
import {
  setProductAttributesSchema,
  type SetProductAttributesInput,
} from "@/features/products/validations/admin-product-attributes.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Product UUID is required");
      }

      const attributes = await attributeService.getAttributesForProduct(uuid);
      return apiSuccess(attributes, "Product attributes fetched successfully");
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN"],
  }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Product UUID is required");
      }

      const body = context.body as SetProductAttributesInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const attributes = await attributeService.setAttributesForProduct(
        uuid,
        body.attributes,
        body.force,
        adminEmail
      );

      return apiSuccess(attributes, "Product attributes updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: setProductAttributesSchema,
  }
);
