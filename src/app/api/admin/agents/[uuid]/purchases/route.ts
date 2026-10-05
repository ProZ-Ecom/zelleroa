import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentService } from "@/features/agents/services/agent.service";
import { readPaging, readQuery } from "@/features/agents/lib/api-helpers";

/** The Sales Partner's OWN purchases (they are the buyer). Referral orders are listed by /api/admin/agent-orders. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const result = await agentService.listOwnPurchases(context.params?.uuid ?? "", {
        ...readQuery(context.searchParams, ["orderStatus", "dateFrom", "dateTo"]),
        ...readPaging(context.searchParams),
      });
      return apiSuccess(result.data, "Success", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
