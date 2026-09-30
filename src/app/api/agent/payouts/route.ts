import { createApiHandler } from "@/lib/api/api-handler";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { payoutService } from "@/features/agents/services/payout.service";
import { requestPayoutSchema, type RequestPayoutInput } from "@/features/agents/validations/agent.schema";
import { readPaging, readQuery, requireSessionAgent } from "@/features/agents/lib/api-helpers";

const handler = createApiHandler(
  {
    GET: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      const [result, balance] = await Promise.all([
        payoutService.list(
          { ...readQuery(context.searchParams, ["status", "dateFrom", "dateTo"]), ...readPaging(context.searchParams) },
          { agentId }
        ),
        payoutService.availableBalance(agentId),
      ]);
      return apiSuccess({ payouts: result.data, availableForPayout: balance }, "Success", 200, result.meta);
    },
    POST: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      const payout = await payoutService.requestPayout(agentId, context.body as RequestPayoutInput);
      return apiCreated(payout, "Payout requested. It will be reviewed by the admin.");
    },
  },
  {
    requireAuth: true,
    requiredRole: ["AGENT"],
    bodySchema: requestPayoutSchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
  }
);

export const GET = handler;
export const POST = handler;
