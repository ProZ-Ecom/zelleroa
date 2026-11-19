import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { customerProfileService } from "@/features/customers/services/customer-profile.service";
import {
  updateCustomerProfileSchema,
  type UpdateCustomerProfileInput,
} from "@/features/customers/validations/customer-profile.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const profile = await customerProfileService.getCustomerProfile(sessionUserId);

      return apiSuccess(profile, "Profile fetched successfully", 200);
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

      const body = context.body as UpdateCustomerProfileInput;

      const profile = await customerProfileService.updateCustomerProfile(
        sessionUserId,
        body
      );

      return apiSuccess(profile, "Profile updated successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    bodySchema: updateCustomerProfileSchema,
  }
);
