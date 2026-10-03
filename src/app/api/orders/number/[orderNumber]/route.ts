import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiFromError } from "@/lib/api/api-response";
import { orderService } from "@/features/orders/services/order.service";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      try {
        const userId = parseInt((context.session?.user as { id?: string })?.id ?? "0");
        if (!userId) return apiFromError(new Error("Unauthorized"));
        const orderNumber = context.params?.orderNumber ?? "";
        const order = await orderService.getOrderByNumber(userId, orderNumber);

        if (!order) {
          return apiFromError(new Error("Order not found"));
        }

        return apiSuccess(order, "Order fetched successfully");
      } catch (error) {
        return apiFromError(error);
      }
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"] }
);
