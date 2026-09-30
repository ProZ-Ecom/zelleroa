import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { payoutService } from "@/features/agents/services/payout.service";
import { readPaging, readQuery } from "@/features/agents/lib/api-helpers";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const result = await payoutService.list({
        ...readQuery(context.searchParams, ["agent", "status", "dateFrom", "dateTo"]),
        ...readPaging(context.searchParams),
      });
      return apiSuccess(result.data, "Success", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
