import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentService } from "@/features/agents/services/agent.service";
import { readPaging, readQuery, requireSessionAgent } from "@/features/agents/lib/api-helpers";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      const result = await agentService.listCustomers(agentId, {
        ...readQuery(context.searchParams, ["search"]),
        ...readPaging(context.searchParams),
      });
      return apiSuccess(result.data, "Success", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["AGENT"] }
);
