import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentProfileService } from "@/features/agents/services/agent-profile.service";
import { saveSectionSchema, type SaveSectionInput } from "@/features/agents/validations/agent-profile.schema";
import { requireSessionAgent } from "@/features/agents/lib/api-helpers";

const handler = createApiHandler(
  {
    GET: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      return apiSuccess(await agentProfileService.get(agentId));
    },
    PUT: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      const body = context.body as SaveSectionInput;
      const profile = await agentProfileService.saveSection(agentId, body.section, body.data, Boolean(body.strict));
      return apiSuccess(profile, "Saved");
    },
  },
  { requireAuth: true, requiredRole: ["AGENT"], bodySchema: saveSectionSchema, rateLimit: { limit: 30, windowMs: 60_000 } }
);

export const GET = handler;
export const PUT = handler;
