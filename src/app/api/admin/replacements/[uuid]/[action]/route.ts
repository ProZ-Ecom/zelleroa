import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { replacementService } from "@/features/replacements/services/replacement.service";
import { REPLACEMENT_TRANSITIONS, type ReplacementAction } from "@/features/returns/lib/policy";
import {
  requestActionSchema,
  returnUuidParamSchema,
  type RequestActionInput,
} from "@/features/returns/validations/return.schema";

/**
 * POST /api/admin/replacements/:uuid/:action
 * action: review | approve | reject | pickup | picked-up | process | ship | complete | close
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const adminSessionUserId = context.session?.user?.id;
      if (!adminSessionUserId) throw ApiError.unauthorized("Authentication required");

      const parsed = returnUuidParamSchema.safeParse({ uuid: context.params?.uuid });
      if (!parsed.success) throw ApiError.badRequest("Invalid replacement UUID format");

      const action = context.params?.action as ReplacementAction;
      if (!Object.hasOwn(REPLACEMENT_TRANSITIONS, action)) throw ApiError.notFound("Unknown action");

      const result = await replacementService.performAction(
        adminSessionUserId,
        parsed.data.uuid,
        action,
        (context.body || {}) as RequestActionInput
      );
      return apiSuccess(result, `${REPLACEMENT_TRANSITIONS[action].label} completed`, 200);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"], bodySchema: requestActionSchema }
);
