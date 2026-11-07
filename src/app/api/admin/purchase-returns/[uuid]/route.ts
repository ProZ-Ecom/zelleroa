import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { purchaseReturnService } from "@/features/purchases/services/purchase-return.service";
import {
  updatePurchaseReturnSchema,
  type UpdatePurchaseReturnInput,
} from "@/features/purchases/validations/purchase-return.schema";

const roles = ["ADMIN", "STAFF"];

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const ret = await purchaseReturnService.get(context.params?.uuid ?? "");
      return apiSuccess(ret, "Purchase return fetched successfully");
    },
  },
  { requireAuth: true, requiredRole: roles }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const ret = await purchaseReturnService.update(
        context.params?.uuid ?? "",
        context.body as UpdatePurchaseReturnInput,
        context.session?.user?.email
      );
      return apiSuccess(ret, "Purchase return updated");
    },
  },
  { method: "PUT", requireAuth: true, requiredRole: roles, bodySchema: updatePurchaseReturnSchema }
);
