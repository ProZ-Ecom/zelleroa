import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { customerAddressService } from "@/features/customers/services/customer-address.service";
import {
  updateCustomerAddressSchema,
  type UpdateCustomerAddressInput,
} from "@/features/customers/validations/customer-address.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Address UUID is required");
      }

      const address = await customerAddressService.getAddressByUuid(
        sessionUserId,
        uuid
      );

      return apiSuccess(address, "Address fetched successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
  }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Address UUID is required");
      }

      const body = context.body as UpdateCustomerAddressInput;

      const address = await customerAddressService.updateAddress(
        sessionUserId,
        uuid,
        body
      );

      return apiSuccess(address, "Address updated successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    bodySchema: updateCustomerAddressSchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Address UUID is required");
      }

      const result = await customerAddressService.deleteAddress(
        sessionUserId,
        uuid
      );

      return apiSuccess(null, result.message, 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
  }
);
