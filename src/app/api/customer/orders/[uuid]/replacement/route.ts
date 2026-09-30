import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { replacementService } from "@/features/replacements/services/replacement.service";
import {
  submitReplacementSchema,
  type SubmitReplacementInput,
} from "@/features/replacements/validations/replacement.schema";

/** POST /api/customer/orders/:uuid/replacement - create a replacement request. */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) throw ApiError.unauthorized("Authentication required");

      const orderUuid = context.params?.uuid;
      if (!orderUuid) throw ApiError.badRequest("Order UUID is required");

      const result = await replacementService.createCustomerReplacementRequest(
        sessionUserId,
        orderUuid,
        context.body as SubmitReplacementInput
      );
      return apiSuccess(
        result,
        "Replacement request submitted successfully. Our team will review your request.",
        201
      );
    },
  },
  {
    requireAuth: true,
    requiredRole: ["CUSTOMER"],
    bodySchema: submitReplacementSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
  }
);
