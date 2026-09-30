import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { stockService } from "@/features/inventory/services/stock.service";
import { adjustmentSchema, type AdjustmentInput } from "@/features/inventory/validations/stock.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const result = await stockService.adjust(
        context.body as AdjustmentInput,
        context.session?.user?.email
      );
      return apiSuccess(result, "Stock adjusted");
    },
  },
  { method: "POST", requireAuth: true, requiredRole: ["ADMIN", "STAFF"], bodySchema: adjustmentSchema }
);
