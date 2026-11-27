import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { razorpayService } from "@/features/payment/services/razorpay.service";
import {
  recoverRazorpayPaymentSchema,
  type RecoverRazorpayPaymentInput,
} from "@/features/payment/validations/payment.schema";

/**
 * POST /api/customer/payment/recover
 * Recover an in-flight Razorpay payment after a page refresh or interrupted
 * verification callback by checking Razorpay directly and claiming/creating the
 * order idempotently.
 */
export const POST = createApiHandler(
  {
    POST: async (request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const body = context.body as RecoverRazorpayPaymentInput;
      const result = await razorpayService.recoverCheckoutPayment(
        sessionUserId,
        body,
        request
      );

      return apiSuccess(result, "Payment status checked");
    },
  },
  {
    requireAuth: true,
    requiredRole: ["CUSTOMER", "AGENT"],
    bodySchema: recoverRazorpayPaymentSchema,
  }
);
