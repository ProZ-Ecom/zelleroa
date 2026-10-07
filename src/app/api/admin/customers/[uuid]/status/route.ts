import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { adminCustomerService } from "@/features/customers/services/admin-customer.service";
import {
  updateCustomerStatusSchema,
  type UpdateCustomerStatusInput,
} from "@/features/customers/validations/admin-customer.schema";

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const uuid = context.params?.uuid;
      if (!uuid || typeof uuid !== "string") {
        throw ApiError.badRequest("Invalid customer UUID");
      }

      const body = context.body as UpdateCustomerStatusInput;
      const adminSessionUserId = context.session?.user?.id;

      const customer = await adminCustomerService.updateCustomerStatus(
        uuid,
        body.isActive,
        adminSessionUserId,
        body.blockReason
      );

      const message = body.isActive
        ? "Customer activated successfully"
        : "Customer deactivated successfully";

      return apiSuccess(customer, message, 200);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: updateCustomerStatusSchema,
  }
);
