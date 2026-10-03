import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { stockService } from "@/features/inventory/services/stock.service";

export const GET = createApiHandler(
  {
    GET: async () => apiSuccess(await stockService.dashboard(), "Inventory dashboard fetched"),
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
