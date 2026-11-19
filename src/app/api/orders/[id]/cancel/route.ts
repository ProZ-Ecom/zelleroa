import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiFromError } from "@/lib/api/api-response";
import { orderService } from "@/features/orders/services/order.service";
import { cancelOrderSchema } from "@/features/orders/validations/order.schema";
import type { CancelOrderSchemaInput } from "@/features/orders/validations/order.schema";

export const PATCH = createApiHandler(
  {
    PATCH: async (_request, context) => {
      try {
        const userId = parseInt((context.session?.user as { id?: string })?.id ?? "0");
        if (!userId) return apiFromError(new Error("Unauthorized"));
        const id = context.params?.id ?? "";
        const body = (context.body as any) ?? {};
        const order = await orderService.cancelOrder(userId, id, {
          reason: body.reason,
          comment: body.comment,
        });
        return apiSuccess(order, "Order cancelled successfully");
      } catch (error) {
        return apiFromError(error);
      }
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"], bodySchema: cancelOrderSchema }
);
