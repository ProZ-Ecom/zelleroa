import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { purchaseReturnService } from "@/features/purchases/services/purchase-return.service";

/** The lines of a received purchase order that can still be sent back. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const order = await purchaseReturnService.returnable(context.params?.uuid ?? "");
      return apiSuccess(order, "Returnable items fetched successfully");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
