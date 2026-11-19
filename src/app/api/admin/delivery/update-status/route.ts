import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { deliveryService } from "@/features/delivery/services/delivery.service";
import { isManualDeliveryStatusEnabled } from "@/features/delivery/lib/delivery-config";
import {
  updateCourierStatusSchema,
  type UpdateCourierStatusInput,
} from "@/features/delivery/validations/delivery.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      if (!isManualDeliveryStatusEnabled()) {
        throw ApiError.forbidden(
          "Manual courier delivery status updates are disabled in production mode. Status updates are managed automatically by the courier partner."
        );
      }

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
