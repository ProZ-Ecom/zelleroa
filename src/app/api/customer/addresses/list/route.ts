import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { customerAddressService } from "@/features/customers/services/customer-address.service";
import {
  customerAddressListSchema,
  type CustomerAddressListInput,
} from "@/features/customers/validations/customer-address.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const body = (context.body || {}) as CustomerAddressListInput;
      const result = await customerAddressService.getAddressesList(
        sessionUserId,
        body
      );

      return apiSuccess(
        result.data,
        "Customer addresses fetched successfully",
        200,
        result.meta
      );
    },
  },
  {
    requireAuth: true,
    requiredRole: ["CUSTOMER", "AGENT", "ADMIN", "STAFF"],
    bodySchema: customerAddressListSchema,
  }
);
