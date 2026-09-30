import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { purchaseService } from "@/features/purchases/services/purchase.service";
import {
  purchaseOrderSchema,
  type PurchaseOrderInput,
} from "@/features/purchases/validations/purchase.schema";

const roles = ["ADMIN", "STAFF"];

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const po = await purchaseService.get(context.params!.uuid);
      return apiSuccess(po, "Purchase order fetched successfully");
    },
  },
  { requireAuth: true, requiredRole: roles }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const po = await purchaseService.update(
        context.params!.uuid,
        context.body as PurchaseOrderInput,
        context.session?.user?.email
      );
      return apiSuccess(po, "Purchase order updated successfully");
    },
  },
  { method: "PUT", requireAuth: true, requiredRole: roles, bodySchema: purchaseOrderSchema }
);
