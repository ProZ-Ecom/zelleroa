import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { purchaseReturnService } from "@/features/purchases/services/purchase-return.service";
import {
  purchaseReturnActionSchema,
  type PurchaseReturnActionInput,
} from "@/features/purchases/validations/purchase-return.schema";

/** Submits, completes or cancels a return. Completing is what moves stock. */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const ret = await purchaseReturnService.act(
        context.params?.uuid ?? "",
        context.body as PurchaseReturnActionInput,
        context.session?.user?.email
      );
      return apiSuccess(ret, "Purchase return updated");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: purchaseReturnActionSchema,
  }
);
