import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { customerProfileService } from "@/features/customers/services/customer-profile.service";

export const POST = createApiHandler(
  {
    POST: async (request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      // 1. Validate Content-Type before calling request.formData()
      const contentType = request.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("multipart/form-data")) {
        throw ApiError.badRequest("Content-Type must be multipart/form-data");
      }

      // 2. Parse FormData safely
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        throw ApiError.badRequest("Content-Type must be multipart/form-data");
      }

      // 3. Process Upload via Customer Profile Service
      const result = await customerProfileService.updateCustomerProfileImage(
        sessionUserId,
        formData
      );

      return apiSuccess(result, "Profile image updated successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const result = await customerProfileService.removeCustomerProfileImage(
        sessionUserId
      );

      return apiSuccess(result, "Profile image removed successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
  }
);
