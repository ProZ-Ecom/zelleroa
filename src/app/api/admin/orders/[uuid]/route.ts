import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { orderService } from "@/features/orders/services/order.service";
import { orderRepository } from "@/features/orders/repositories/order.repository";

const updateInvoiceNumberSchema = z.object({
  invoiceNumber: z.string().trim().max(100).optional().nullable(),
});

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Order UUID is required");
      }

      const order = await orderService.getAdminOrderByUuid(uuid);

      return apiSuccess(order, "Order details fetched successfully", 200);
    },
    PATCH: async (request, context) => {
      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Order UUID is required");
      }

      let invoiceNumber: string | null = null;
      if (context.body && typeof (context.body as any).invoiceNumber !== "undefined") {
        const val = (context.body as any).invoiceNumber;
        invoiceNumber = typeof val === "string" ? val.trim() : null;
      } else {
        try {
          const body = await request.clone().json();
          const val = body?.invoiceNumber;
          invoiceNumber = typeof val === "string" ? val.trim() : null;
        } catch {
          invoiceNumber = null;
        }
      }

      await orderRepository.updateOrderInvoiceNumber(uuid, invoiceNumber || null);
      const updated = await orderService.getAdminOrderByUuid(uuid);

      return apiSuccess(updated, "Invoice number updated successfully", 200);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateInvoiceNumberSchema,
  }
);

export const PATCH = GET;
