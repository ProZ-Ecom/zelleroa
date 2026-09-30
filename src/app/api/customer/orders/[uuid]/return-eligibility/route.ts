import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { eligibilityService } from "@/features/returns/services/eligibility.service";

/** GET /api/customer/orders/:uuid/return-eligibility */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) throw ApiError.unauthorized("Authentication required");

      const orderUuid = context.params?.uuid;
      if (!orderUuid) throw ApiError.badRequest("Order UUID is required");

      const result = await eligibilityService.getForOrder(sessionUserId, orderUuid);
      return apiSuccess(result, "Eligibility fetched successfully", 200);
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER"] }
);
