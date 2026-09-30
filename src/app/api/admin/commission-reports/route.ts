import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { commissionReportService } from "@/features/agents/services/commission-report.service";
import { readQuery } from "@/features/agents/lib/api-helpers";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const q = readQuery(context.searchParams, ["agent", "dateFrom", "dateTo"]);
      return apiSuccess(await commissionReportService.summary(q));
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
