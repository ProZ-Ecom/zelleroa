import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { orderService } from "@/features/orders/services/order.service";
import {
  customerOrdersListSchema,
  type CustomerOrdersListInput,
} from "@/features/orders/validations/order.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const body = (context.body || {}) as CustomerOrdersListInput;
      const query = (context.query || {}) as Record<string, any>;
      const merged = { ...query, ...body };

      const result = await orderService.getCustomerOrders(sessionUserId, merged);

      return apiSuccess(
        result.data,
        "Customer orders fetched successfully",
        200,
        result.meta
      );
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    bodySchema: customerOrdersListSchema,
  }
);

