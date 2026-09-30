import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { stockService } from "@/features/inventory/services/stock.service";
import { stockListQuerySchema, type StockListQuery } from "@/features/inventory/validations/stock.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const result = await stockService.currentStock(context.query as StockListQuery);
      return apiSuccess(result.data, "Stock fetched", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"], querySchema: stockListQuerySchema }
);
