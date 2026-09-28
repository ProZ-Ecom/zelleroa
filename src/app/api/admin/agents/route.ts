import { createApiHandler } from "@/lib/api/api-handler";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { agentService } from "@/features/agents/services/agent.service";
import { createAgentSchema, type CreateAgentInput } from "@/features/agents/validations/agent.schema";
import { readPaging, readQuery, resolveActor } from "@/features/agents/lib/api-helpers";

const handler = createApiHandler(
  {
    GET: async (_request, context) => {
      const q = readQuery(context.searchParams, ["search", "status"]);
      const result = await agentService.listAgents({
        search: q.search,
        status: q.status === "active" || q.status === "inactive" ? q.status : undefined,
        ...readPaging(context.searchParams),
      });
      return apiSuccess(result.data, "Success", 200, result.meta);
    },
    POST: async (_request, context) => {
      const actor = await resolveActor(context.session);
      const agent = await agentService.createAgent(context.body as CreateAgentInput, actor);
      return apiCreated(agent, "Agent created successfully");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: createAgentSchema }
);

export const GET = handler;
export const POST = handler;
