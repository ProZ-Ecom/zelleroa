import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { userService } from "@/features/users/services/user.service";
import { resetPasswordSchema } from "@/features/users/validations/user.schema";

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const id = context.params?.id;
      if (!id) return apiError("User ID is required", 400);
      const body = context.body as ReturnType<typeof resetPasswordSchema.parse>;
      await userService.resetPassword(id, body.password);
      return apiSuccess(null, "Password reset successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: resetPasswordSchema,
  }
);
