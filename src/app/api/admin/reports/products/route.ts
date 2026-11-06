import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { readQuery } from "@/features/agents/lib/api-helpers";
import { productsReportService } from "@/features/reports/services/products-report.service";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const q = readQuery(context.searchParams, ["dateFrom", "dateTo", "category", "brand"]);
      return apiSuccess(await productsReportService.summary(q));
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
