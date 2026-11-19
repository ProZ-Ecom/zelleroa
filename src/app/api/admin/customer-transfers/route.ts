import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { customerAssignmentService } from "@/features/agents/services/customer-assignment.service";
import { readPaging, readQuery } from "@/features/agents/lib/api-helpers";

/** Admin: transfer history across all customers, filterable by customer or Sales Partner. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const q = readQuery(context.searchParams, ["customer", "agent"]);
      const result = await customerAssignmentService.listHistory({
        customerRef: q.customer,
        agentRef: q.agent,
        ...readPaging(context.searchParams),
      });
      return apiSuccess(result.data, "Success", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
