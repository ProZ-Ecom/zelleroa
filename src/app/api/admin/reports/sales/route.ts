import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { readQuery } from "@/features/agents/lib/api-helpers";
import { salesReportService } from "@/features/reports/services/sales-report.service";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const q = readQuery(context.searchParams, ["dateFrom", "dateTo", "agent", "source"]);
      return apiSuccess(await salesReportService.summary(q));
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
