import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { orderService } from "@/features/orders/services/order.service";
import {
  orderStatusTransitionSchema,
  type OrderStatusTransitionInput,
} from "@/features/orders/validations/order.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId =
        context.session?.user?.id ||
        (context.session?.user as any)?.email;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Unauthorized");
      }

      const uuid = context.params?.uuid;
      if (!uuid || typeof uuid !== "string") {
        throw ApiError.badRequest("Invalid order UUID");
      }

      const body = (context.body || {}) as OrderStatusTransitionInput;
      const result = await orderService.confirmOrder(
        sessionUserId,
        uuid,
        body
      );

      return apiSuccess(result, "Order confirmed successfully", 200);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: orderStatusTransitionSchema,
  }
);
