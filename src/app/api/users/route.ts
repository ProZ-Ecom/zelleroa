import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { userService } from "@/features/users/services/user.service";
import { getUsersQuerySchema, createUserSchema } from "@/features/users/validations/user.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as ReturnType<typeof getUsersQuerySchema.parse>;
      const result = await userService.getUsers({
        page: query.page,
        limit: query.limit,
        search: query.search,
        status: query.status,
        roleId: query.roleId,
      });
      return apiSuccess(result.data, "Users fetched successfully", 200, result.meta);
    },
  },
  {
    querySchema: getUsersQuerySchema,
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as ReturnType<typeof createUserSchema.parse>;
      const user = await userService.createUser(body);
      return apiCreated(user, "User created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: createUserSchema,
  }
);
