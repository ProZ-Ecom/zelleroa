import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { otpService } from "@/features/auth/services/otp.service";
import {
  sendEmailOtpSchema,
  type SendEmailOtpInput,
} from "@/features/auth/validations/auth.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as SendEmailOtpInput;

      const result = await otpService.sendRegistrationEmailOtp(
        body.email,
        body.phone
      );

      return apiSuccess(result.data, result.message, 200);
    },
  },
  {
    method: "POST",
    bodySchema: sendEmailOtpSchema,
    rateLimit: { limit: 5, windowMs: 60_000 },
  }
);
