import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentService, buildReferralLink } from "@/features/agents/services/agent.service";
import { commissionService } from "@/features/agents/services/commission.service";
import { payoutService } from "@/features/agents/services/payout.service";
import { requireSessionAgent } from "@/features/agents/lib/api-helpers";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      // Sweep first so the summary and balance both see freshly-approved commissions.
      await commissionService.markReadyForApproval({ agentId });
      const [profile, balance, summary] = await Promise.all([
        agentService.getProfile(agentId),
        payoutService.availableBalance(agentId, { skipSweep: true }),
        agentService.getSummary(agentId),
      ]);
      return apiSuccess({
        agentCode: profile.agentCode,
        referralCode: profile.referralCode,
        referralLink: profile.referralCode ? buildReferralLink(profile.referralCode) : null,
        summary,
        availableForPayout: balance,
      });
    },
  },
  { requireAuth: true, requiredRole: ["AGENT"] }
);
