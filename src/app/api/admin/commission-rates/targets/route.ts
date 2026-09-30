import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { commissionRateService } from "@/features/agents/services/commission-rate.service";

export const GET = createApiHandler(
  { GET: async () => apiSuccess(await commissionRateService.targets()) },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
