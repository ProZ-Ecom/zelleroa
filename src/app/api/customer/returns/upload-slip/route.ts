import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { resolveCustomerId } from "@/features/returns/services/eligibility.service";
import { slipService } from "@/features/returns/services/slip.service";

/** POST /api/customer/returns/upload-slip - multipart field `file`. */
export const POST = createApiHandler(
  {
    POST: async (request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) throw ApiError.unauthorized("Authentication required");

      const customerId = await resolveCustomerId(sessionUserId);
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        throw ApiError.badRequest("A delivery slip photo is required");
      }

      const saved = await slipService.saveShippingSlip(customerId, file);
      return apiSuccess(saved, "Delivery slip uploaded successfully", 201);
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["CUSTOMER"],
    rateLimit: { limit: 10, windowMs: 60_000 },
  }
);
