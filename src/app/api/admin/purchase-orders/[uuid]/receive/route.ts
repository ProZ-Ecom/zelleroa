import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { purchaseService } from "@/features/purchases/services/purchase.service";
import { receiveSchema, type ReceiveInput } from "@/features/purchases/validations/purchase.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const po = await purchaseService.receive(
        context.params!.uuid,
        context.body as ReceiveInput,
        context.session?.user?.email
      );
      return apiSuccess(po, "Goods received and stock updated");
    },
  },
  { method: "POST", requireAuth: true, requiredRole: ["ADMIN", "STAFF"], bodySchema: receiveSchema }
);
