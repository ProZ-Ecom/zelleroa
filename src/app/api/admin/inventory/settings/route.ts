import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { stockService } from "@/features/inventory/services/stock.service";
import { stockSettingsSchema } from "@/features/inventory/validations/stock.schema";
import type { z } from "zod";

export const GET = createApiHandler(
  {
    GET: async () =>
      apiSuccess({ lowStockThreshold: await stockService.getThreshold() }, "Settings fetched"),
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const body = context.body as z.infer<typeof stockSettingsSchema>;
      return apiSuccess(
        await stockService.setThreshold(body.lowStockThreshold, context.session?.user?.email),
        "Low-stock threshold updated"
      );
    },
  },
  { method: "PUT", requireAuth: true, requiredRole: ["ADMIN"], bodySchema: stockSettingsSchema }
);
