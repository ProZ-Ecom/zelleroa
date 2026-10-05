import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { customerAddressService } from "@/features/customers/services/customer-address.service";
import {
  createCustomerAddressSchema,
  customerAddressQuerySchema,
  type CreateCustomerAddressInput,
  type CustomerAddressQueryInput,
} from "@/features/customers/validations/customer-address.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const query = (context.query || {}) as CustomerAddressQueryInput;
      const addresses = await customerAddressService.getAddresses(
        sessionUserId,
        query
      );

      return apiSuccess(addresses, "Addresses fetched successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    querySchema: customerAddressQuerySchema,
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const body = context.body as CreateCustomerAddressInput;

      const address = await customerAddressService.createAddress(
        sessionUserId,
        body
      );

      return apiCreated(address, "Address created successfully");
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    bodySchema: createCustomerAddressSchema,
  }
);
