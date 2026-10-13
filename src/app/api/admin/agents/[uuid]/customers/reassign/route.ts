import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { customerAssignmentService } from "@/features/agents/services/customer-assignment.service";
import { reassignCustomersSchema, type ReassignCustomersInput } from "@/features/agents/validations/agent.schema";
import { resolveActor } from "@/features/agents/lib/api-helpers";

/** Admin only: move some (or all) of this Sales Partner's customers to another active Sales Partner. */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const actor = await resolveActor(context.session);
      const body = context.body as ReassignCustomersInput;
      const result = await customerAssignmentService.reassignFromAgent(
        {
          fromAgentRef: context.params?.uuid ?? "",
          toAgentRef: body.toAgentId,
          customerRefs: body.customerIds,
          reason: body.reason,
        },
        actor
      );
      return apiSuccess(result, "Customers reassigned");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: reassignCustomersSchema }
);
