import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { returnService } from "@/features/returns/services/return.service";
import {
  submitReturnSchema,
  type SubmitReturnInput,
} from "@/features/returns/validations/return.schema";

/** POST /api/customer/orders/:uuid/return - create a return request. */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) throw ApiError.unauthorized("Authentication required");

      const orderUuid = context.params?.uuid;
      if (!orderUuid) throw ApiError.badRequest("Order UUID is required");

      const result = await returnService.createCustomerReturnRequest(
        sessionUserId,
        orderUuid,
        context.body as SubmitReturnInput
      );
      return apiSuccess(
        result,
        "Return request submitted successfully. Our team will review your request.",
        201
      );
    },
  },
  {
    requireAuth: true,
    requiredRole: ["CUSTOMER"],
    bodySchema: submitReturnSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
  }
);
