import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { deliveryService } from "@/features/delivery/services/delivery.service";
import {
  updateCourierStatusSchema,
  type UpdateCourierStatusInput,
} from "@/features/delivery/validations/delivery.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as UpdateCourierStatusInput;
      const adminEmail = context.session?.user?.email;
      const result = await deliveryService.updateCourierStatus(body, adminEmail);

      const statusLabel =
        result.status === "out_for_delivery" ? "Out for Delivery" : "Delivered";

      return apiSuccess(
        result,
        `Order #${result.orderNumber} marked as ${statusLabel}`,
        200
      );
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateCourierStatusSchema,
  }
);
