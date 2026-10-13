import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentService } from "@/features/agents/services/agent.service";
import { readPaging, readQuery } from "@/features/agents/lib/api-helpers";

/** Admin: the customers currently assigned to this Sales Partner (so they can be moved if it is blocked). */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const result = await agentService.listCustomersForAdmin(context.params?.uuid ?? "", {
        ...readQuery(context.searchParams, ["search", "status"]),
        ...readPaging(context.searchParams),
      });
      return apiSuccess(result.data, "Success", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
