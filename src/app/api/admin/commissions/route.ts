import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { commissionService, getAutoApprove } from "@/features/agents/services/commission.service";
import { readPaging, readQuery } from "@/features/agents/lib/api-helpers";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      await commissionService.markReadyForApproval();
      const [result, autoApprove] = await Promise.all([
        commissionService.list({
          ...readQuery(context.searchParams, ["agent", "customer", "status", "orderStatus", "referralCode", "order", "dateFrom", "dateTo"]),
          ...readPaging(context.searchParams),
        }),
        getAutoApprove(),
      ]);
      return apiSuccess(result.data, "Success", 200, { ...result.meta, autoApprove });
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
