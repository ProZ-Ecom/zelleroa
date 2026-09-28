import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { commissionService } from "@/features/agents/services/commission.service";
import { readPaging, readQuery, requireSessionAgent } from "@/features/agents/lib/api-helpers";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      await commissionService.approveEligible({ agentId });
      const result = await commissionService.list(
        {
          ...readQuery(context.searchParams, ["customer", "order", "referralCode", "status", "orderStatus", "dateFrom", "dateTo"]),
          ...readPaging(context.searchParams),
        },
        { agentId }
      );
      return apiSuccess(result.data, "Success", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["AGENT"] }
);
