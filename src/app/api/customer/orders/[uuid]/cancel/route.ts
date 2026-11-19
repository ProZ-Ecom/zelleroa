import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { orderService } from "@/features/orders/services/order.service";
import {
  cancelOrderSchema,
  type CancelOrderInput,
} from "@/features/orders/validations/order.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Order UUID is required");
      }

      const body = context.body as CancelOrderInput | undefined;
      const order = await orderService.cancelCustomerOrder(
        sessionUserId,
        uuid,
        body
      );

      return apiSuccess(order, "Order cancelled successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    bodySchema: cancelOrderSchema,
  }
);
