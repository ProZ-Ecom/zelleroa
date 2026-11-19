import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { orderService } from "@/features/orders/services/order.service";
import {
  markOrderPaidSchema,
  type MarkOrderPaidInput,
} from "@/features/orders/validations/order.schema";

/**
 * Admin records the cash collected on a Cash-on-Delivery order.
 * Flips the order to `payment_status: paid` and writes a Payment row for it.
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Unauthorized");
      }

      const uuid = context.params?.uuid;
      if (!uuid || typeof uuid !== "string") {
        throw ApiError.badRequest("Invalid order UUID");
      }

      const body = (context.body || {}) as MarkOrderPaidInput;
      const result = await orderService.markOrderPaymentReceived(
        sessionUserId,
        uuid,
        body
      );

      return apiSuccess(result, "Payment recorded successfully", 200);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: markOrderPaidSchema,
  }
);
