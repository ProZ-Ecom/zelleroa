import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { inventoryService } from "@/features/inventory/services/inventory.service";

export const GET = createApiHandler({
  GET: async (_request, context) => {
    const id = Number(context.params?.id);
    const result = await inventoryService.getInventoryItem(id);
    return apiSuccess(result);
  },
}, { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] });
