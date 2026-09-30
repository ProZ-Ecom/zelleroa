import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { replacementService } from "@/features/replacements/services/replacement.service";
import {
  customerReplacementListSchema,
  type ReplacementListInput,
} from "@/features/replacements/validations/replacement.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) throw ApiError.unauthorized("Authentication required");
      const result = await replacementService.getCustomerReplacements(
        sessionUserId,
        (context.body || {}) as ReplacementListInput
      );
      return apiSuccess(result.data, "Replacement requests fetched successfully", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER"], bodySchema: customerReplacementListSchema }
);
