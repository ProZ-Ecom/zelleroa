import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { findAgentByReferralCode } from "@/features/agents/services/referral.service";
import { REFERRAL_AGENT_COOKIE } from "@/lib/referral/cookie";

/**
 * The referral that would apply to an order placed right now (the visitor's
 * `referral_agent` cookie, validated against a live agent). Used by checkout
 * to show who the order is credited to. Only the agent's display name and code
 * are returned.
 */
export const GET = createApiHandler(
  {
    GET: async (request) => {
      const agent = await findAgentByReferralCode(request.cookies.get(REFERRAL_AGENT_COOKIE)?.value);
      return apiSuccess({
        applied: Boolean(agent),
        referralCode: agent?.referralCode ?? null,
        agentName: agent?.name ?? null,
      });
    },
    /** Lets a customer drop the referral so the next order carries no agent. */
    DELETE: async () => {
      const response = apiSuccess({ applied: false, referralCode: null, agentName: null });
      response.cookies.set(REFERRAL_AGENT_COOKIE, "", { path: "/", maxAge: 0 });
      return response;
    },
  },
  { rateLimit: { limit: 30, windowMs: 60_000 } }
);
