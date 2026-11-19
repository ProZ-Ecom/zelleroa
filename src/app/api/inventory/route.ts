import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { inventoryService } from "@/features/inventory/services/inventory.service";
import {
  getInventoryQuerySchema,
  createInventorySchema,
} from "@/features/inventory/validations/inventory.schema";

export const GET = createApiHandler({
  GET: async (request, context) => {
    const searchParams = context.searchParams;
    const raw: Record<string, string> = {};
    searchParams?.forEach((value, key) => {
      raw[key] = value;
    });
    const query = getInventoryQuerySchema.parse(raw);
    const result = await inventoryService.getInventory(query);
    return apiSuccess(result);
  },
}, { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] });

export const POST = createApiHandler({
  POST: async (_request, context) => {
    const input = createInventorySchema.parse(context.body);
    const result = await inventoryService.createInventory(input);
    return apiCreated(result);
  },
}, { requireAuth: true, requiredRole: ["ADMIN", "STAFF"], bodySchema: createInventorySchema });
