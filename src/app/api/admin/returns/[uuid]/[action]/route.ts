import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { returnService } from "@/features/returns/services/return.service";
import { RETURN_TRANSITIONS, type ReturnAction } from "@/features/returns/lib/policy";
import {
  requestActionSchema,
  returnUuidParamSchema,
  type RequestActionInput,
} from "@/features/returns/validations/return.schema";

/**
 * POST /api/admin/returns/:uuid/:action
 * action: review | approve | reject | pickup | picked-up | received | refund | complete | close
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const adminSessionUserId = context.session?.user?.id;
      if (!adminSessionUserId) throw ApiError.unauthorized("Authentication required");

      const parsed = returnUuidParamSchema.safeParse({ uuid: context.params?.uuid });
      if (!parsed.success) throw ApiError.badRequest("Invalid return UUID format");

      const action = context.params?.action as ReturnAction;
      if (!Object.hasOwn(RETURN_TRANSITIONS, action)) throw ApiError.notFound("Unknown action");

      const result = await returnService.performAction(
        adminSessionUserId,
        parsed.data.uuid,
        action,
        (context.body || {}) as RequestActionInput
      );
      return apiSuccess(result, `${RETURN_TRANSITIONS[action].label} completed`, 200);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"], bodySchema: requestActionSchema }
);
