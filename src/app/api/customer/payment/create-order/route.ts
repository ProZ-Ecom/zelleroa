import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { razorpayService } from "@/features/payment/services/razorpay.service";
import {
  createRazorpayOrderSchema,
  type CreateRazorpayOrderInput,
} from "@/features/payment/validations/payment.schema";

/**
 * POST /api/customer/payment/create-order
 * Create a Razorpay Order for an existing pending customer order.
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const body = context.body as CreateRazorpayOrderInput;
      const paymentOrder = await razorpayService.createRazorpayOrder(sessionUserId, body);

      return apiSuccess(paymentOrder, "Razorpay order created successfully");
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    bodySchema: createRazorpayOrderSchema,
  }
);
