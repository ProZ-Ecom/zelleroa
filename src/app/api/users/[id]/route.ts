import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { userService } from "@/features/users/services/user.service";
import { updateUserSchema } from "@/features/users/validations/user.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const id = context.params?.id;
      if (!id) return apiError("User ID is required", 400);
      const user = await userService.getUser(id);
      return apiSuccess(user, "User fetched successfully");
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN"],
  }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const id = context.params?.id;
      if (!id) return apiError("User ID is required", 400);
      const body = context.body as ReturnType<typeof updateUserSchema.parse>;
      const user = await userService.updateUser(id, body);
      return apiSuccess(user, "User updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: updateUserSchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const id = context.params?.id;
      if (!id) return apiError("User ID is required", 400);
      await userService.deleteUser(id);
      return apiSuccess(null, "User deleted successfully");
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN"],
  }
);
