import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { stockService } from "@/features/inventory/services/stock.service";
import {
  movementListQuerySchema,
  type MovementListQuery,
} from "@/features/inventory/validations/stock.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const result = await stockService.movements(context.query as MovementListQuery);
      return apiSuccess(result.data, "Stock movements fetched", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"], querySchema: movementListQuerySchema }
);
