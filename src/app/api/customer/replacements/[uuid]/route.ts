import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { replacementService } from "@/features/replacements/services/replacement.service";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) throw ApiError.unauthorized("Authentication required");
      const uuid = context.params?.uuid;
      if (!uuid) throw ApiError.badRequest("Replacement UUID is required");
      const result = await replacementService.getCustomerReplacementByUuid(sessionUserId, uuid);
      return apiSuccess(result, "Replacement request fetched successfully", 200);
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER"] }
);
