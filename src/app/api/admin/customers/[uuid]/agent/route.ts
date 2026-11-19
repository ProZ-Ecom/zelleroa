import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { customerAssignmentService } from "@/features/agents/services/customer-assignment.service";
import { transferCustomerSchema, type TransferCustomerInput } from "@/features/agents/validations/agent.schema";
import { resolveActor } from "@/features/agents/lib/api-helpers";

/** Admin: who a customer currently belongs to, with their full transfer history. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const uuid = context.params?.uuid ?? "";
      const [current, history] = await Promise.all([
        customerAssignmentService.getCurrentAgent(uuid),
        customerAssignmentService.listHistory({ customerRef: uuid, limit: 100 }),
      ]);
      return apiSuccess({ ...current, history: history.data }, "Success");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);

/** Admin only: assign or transfer this customer to another Sales Partner. */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const actor = await resolveActor(context.session);
      const body = context.body as TransferCustomerInput;
      const result = await customerAssignmentService.transferCustomer(
        {
          customerRef: context.params?.uuid ?? "",
          toAgentRef: body.toAgentId,
          fromAgentRef: body.fromAgentId ?? null,
          reason: body.reason,
        },
        actor
      );
      return apiSuccess(result, "Customer transferred");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: transferCustomerSchema }
);
