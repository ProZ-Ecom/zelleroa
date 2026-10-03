import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { razorpayService } from "@/features/payment/services/razorpay.service";
import {
  verifyRazorpayPaymentSchema,
  type VerifyRazorpayPaymentInput,
} from "@/features/payment/validations/payment.schema";

/**
 * POST /api/customer/payment/verify
 * Cryptographically verify Razorpay signature and transition order to confirmed & paid.
 */
export const POST = createApiHandler(
  {
    POST: async (request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const body = context.body as VerifyRazorpayPaymentInput;
      const result = await razorpayService.verifyPaymentSignature(sessionUserId, body, request);

      return apiSuccess(result, "Payment verified and order confirmed successfully");
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    bodySchema: verifyRazorpayPaymentSchema,
  }
);
