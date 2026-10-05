import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { inventoryService } from "@/features/inventory/services/inventory.service";

export const GET = createApiHandler({
  GET: async () => {
    const result = await inventoryService.getLowStock();
    return apiSuccess(result);
  },
}, { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] });
