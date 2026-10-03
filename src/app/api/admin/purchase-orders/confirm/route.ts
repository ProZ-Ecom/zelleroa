import { createApiHandler } from "@/lib/api/api-handler";
import { apiCreated } from "@/lib/api/api-response";
import { purchaseService } from "@/features/purchases/services/purchase.service";
import {
  confirmPurchaseSchema,
  type ConfirmPurchaseInput,
} from "@/features/purchases/validations/purchase.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const po = await purchaseService.confirm(
        context.body as ConfirmPurchaseInput,
        context.session?.user?.email
      );
      return apiCreated(po, "Purchase confirmed and stock updated");
    },
  },
  { method: "POST", requireAuth: true, requiredRole: ["ADMIN", "STAFF"], bodySchema: confirmPurchaseSchema }
);
