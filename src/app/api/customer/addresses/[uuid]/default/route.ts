import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { customerAddressService } from "@/features/customers/services/customer-address.service";

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

      const result = await customerAddressService.setDefaultAddress(
        sessionUserId,
        uuid
      );

      return apiSuccess(result, "Default address updated successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
  }
);
