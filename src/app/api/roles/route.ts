import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { roleService } from "@/features/roles/services/role.service";
import { createRoleSchema, getRolesQuerySchema } from "@/features/roles/validations/role.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as ReturnType<typeof getRolesQuerySchema.parse>;
      const result = await roleService.getRoles({
        page: query.page,
        limit: query.limit,
        search: query.search,
      });
      return apiSuccess(result.data, "Roles fetched successfully", 200, result.meta);
    },
  },
  {
    querySchema: getRolesQuerySchema,
    requireAuth: true,
    requiredRole: ["ADMIN"],
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as ReturnType<typeof createRoleSchema.parse>;
      const role = await roleService.createRole(body);
      return apiCreated(role, "Role created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: createRoleSchema,
  }
);
