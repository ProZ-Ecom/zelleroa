import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { purchaseService } from "@/features/purchases/services/purchase.service";
import {
  purchaseActionSchema,
  type PurchaseActionInput,
} from "@/features/purchases/validations/purchase.schema";

// Approving or rejecting is an admin decision; staff can draft, submit, order and cancel.
const ADMIN_ONLY_ACTIONS: PurchaseActionInput["action"][] = ["approve", "reject"];

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as PurchaseActionInput;
      if (
        ADMIN_ONLY_ACTIONS.includes(body.action) &&
        context.session?.user?.role !== "ADMIN"
      ) {
        throw ApiError.forbidden("Only an admin can approve or reject a purchase order");
      }
      const po = await purchaseService.act(
        context.params!.uuid,
        body,
        context.session?.user?.email
      );
      return apiSuccess(po, "Purchase order updated");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: purchaseActionSchema,
  }
);
