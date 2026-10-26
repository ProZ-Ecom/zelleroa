import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { valuationService } from "@/features/inventory/services/valuation.service";
import {
  valuationQuerySchema,
  type ValuationQuery,
} from "@/features/inventory/validations/valuation.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as ValuationQuery;
      if (query.view === "sales") {
        const report = await valuationService.salesMargin(query);
        return apiSuccess(report, "Sales margin fetched");
      }
      const report = await valuationService.stockValuation(query);
      return apiSuccess(report, "Stock valuation fetched");
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    querySchema: valuationQuerySchema,
  }
);
