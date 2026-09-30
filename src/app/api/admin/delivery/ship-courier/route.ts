import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { deliveryService } from "@/features/delivery/services/delivery.service";
import {
  shipViaCourierSchema,
  type ShipViaCourierInput,
} from "@/features/delivery/validations/delivery.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as ShipViaCourierInput;
      const adminEmail = context.session?.user?.email;
      const result = await deliveryService.shipViaIndiaPost(body, adminEmail);

      return apiSuccess(result, "Shipment recorded with India Post", 201);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: shipViaCourierSchema,
  }
);
