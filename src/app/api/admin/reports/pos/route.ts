import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { readQuery } from "@/features/agents/lib/api-helpers";
import { posReportService, type PosFilters } from "@/features/reports/services/pos-report.service";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const q = readQuery(context.searchParams, [
        "dateFrom",
        "dateTo",
        "cashier",
        "tender",
        "status",
      ]) as PosFilters;
      return apiSuccess(await posReportService.getReport(q), "POS report generated");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
