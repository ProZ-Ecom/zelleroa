import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { findAgentByReferralCode } from "@/features/agents/services/referral.service";

/** Public: is this a live agent code? Returns only the agent's display name. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const agent = await findAgentByReferralCode(context.searchParams?.get("code"));
      return apiSuccess({ valid: Boolean(agent), agentName: agent?.name ?? null });
    },
  },
  { rateLimit: { limit: 30, windowMs: 60_000 } }
);
