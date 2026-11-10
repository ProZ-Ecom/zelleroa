import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { readQuery } from "@/features/agents/lib/api-helpers";
import { ordersReportService } from "@/features/reports/services/orders-report.service";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const q = readQuery(context.searchParams, ["dateFrom", "dateTo", "status", "paymentStatus", "agent", "source"]);
      return apiSuccess(await ordersReportService.summary(q));
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
