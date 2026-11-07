import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { returnService } from "@/features/returns/services/return.service";
import {
  RETURN_CUSTOMER_ACTIONS,
  RETURN_TRANSITIONS,
  type ReturnAction,
} from "@/features/returns/lib/policy";
import {
  customerReturnActionSchema,
  returnUuidParamSchema,
  type CustomerReturnActionInput,
} from "@/features/returns/validations/return.schema";

/**
 * POST /api/customer/returns/:uuid/:action
 * action: shipped | cancel - the two steps the customer drives themselves.
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) throw ApiError.unauthorized("Authentication required");

      const parsed = returnUuidParamSchema.safeParse({ uuid: context.params?.uuid });
      if (!parsed.success) throw ApiError.badRequest("Invalid return UUID format");

      const action = context.params?.action as ReturnAction;
      if (!RETURN_CUSTOMER_ACTIONS.includes(action)) {
        throw ApiError.notFound("Unknown action");
      }

      const result = await returnService.performCustomerAction(
        sessionUserId,
        parsed.data.uuid,
        action,
        (context.body || {}) as CustomerReturnActionInput
      );
      return apiSuccess(result, `${RETURN_TRANSITIONS[action].label} completed`, 200);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["CUSTOMER"],
    bodySchema: customerReturnActionSchema,
  }
);
