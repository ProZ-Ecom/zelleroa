import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { orderService } from "@/features/orders/services/order.service";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const uuid = context.params?.uuid;
      if (!uuid || uuid === "undefined" || uuid === "null" || uuid.trim() === "") {
        throw ApiError.badRequest("Valid Order UUID is required");
      }

      const order = await orderService.getCustomerOrderByUuid(sessionUserId, uuid);

      return apiSuccess(order, "Order details fetched successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
  }
);
