import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentService } from "@/features/agents/services/agent.service";
import { readPaging, readQuery } from "@/features/agents/lib/api-helpers";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const result = await agentService.listOrderLines({
        ...readQuery(context.searchParams, ["agent", "order", "referralCode", "customer", "orderSource", "orderStatus", "commissionStatus", "dateFrom", "dateTo"]),
        ...readPaging(context.searchParams),
      });
      return apiSuccess(result.data, "Success", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
