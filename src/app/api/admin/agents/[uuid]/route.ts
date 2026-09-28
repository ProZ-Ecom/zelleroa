import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentService } from "@/features/agents/services/agent.service";
import { updateAgentSchema, type UpdateAgentInput } from "@/features/agents/validations/agent.schema";
import { resolveActor } from "@/features/agents/lib/api-helpers";

const update: Parameters<typeof createApiHandler>[0]["PUT"] = async (_request, context) => {
  const actor = await resolveActor(context.session);
  const agent = await agentService.updateAgent(context.params?.uuid ?? "", context.body as UpdateAgentInput, actor);
  return apiSuccess(agent, "Agent updated");
};

const handler = createApiHandler(
  {
    GET: async (_request, context) => apiSuccess(await agentService.getAgentDetail(context.params?.uuid ?? "")),
    PUT: update,
    PATCH: update,
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: updateAgentSchema }
);

export const GET = handler;
export const PUT = handler;
export const PATCH = handler;
