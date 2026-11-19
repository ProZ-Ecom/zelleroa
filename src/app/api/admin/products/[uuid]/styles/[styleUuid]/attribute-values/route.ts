import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { attributeService } from "@/features/attributes/services/attribute.service";
import {
  setStyleAttributeValuesSchema,
  type SetStyleAttributeValuesInput,
} from "@/features/styles/validations/admin-style-attribute-values.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const styleUuid = context.params?.styleUuid;
      const productUuid = context.params?.uuid;
      if (!styleUuid || !productUuid) {
        throw ApiError.badRequest("Product and style UUIDs are required");
      }

      const groups = await attributeService.getAttributeValuesForStyle(styleUuid, productUuid);
      return apiSuccess(groups, "Style attribute values fetched successfully");
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
      const styleUuid = context.params?.styleUuid;
      const productUuid = context.params?.uuid;
      if (!styleUuid || !productUuid) {
        throw ApiError.badRequest("Product and style UUIDs are required");
      }

      const body = context.body as SetStyleAttributeValuesInput;
      const groups = await attributeService.setAttributeValuesForStyle(
        styleUuid,
        body.attributeValueIds,
        productUuid
      );

      return apiSuccess(groups, "Style attribute values updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: setStyleAttributeValuesSchema,
  }
);
