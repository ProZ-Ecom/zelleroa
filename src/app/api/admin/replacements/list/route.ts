import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { replacementService } from "@/features/replacements/services/replacement.service";
import {
  adminReplacementListSchema,
  type ReplacementListInput,
} from "@/features/replacements/validations/replacement.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const result = await replacementService.getAdminReplacements(
        (context.body || {}) as ReplacementListInput
      );
      return apiSuccess(result.data, "Replacement requests fetched successfully", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"], bodySchema: adminReplacementListSchema }
);
