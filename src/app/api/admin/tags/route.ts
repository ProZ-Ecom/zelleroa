import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { tagService } from "@/features/tags/services/tag.service";
import {
  createAdminTagSchema,
  adminTagQuerySchema,
  type CreateAdminTagInput,
  type AdminTagQueryInput,
} from "@/features/tags/validations/admin-tag.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as AdminTagQueryInput;
      const result = await tagService.getAdminTags({
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 50,
        search: query?.search,
      });

      return apiSuccess(result.data, "Tags fetched successfully", 200, result.meta);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN"],
    querySchema: adminTagQuerySchema,
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as CreateAdminTagInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const tag = await tagService.createTag(body, adminEmail);
      return apiCreated(tag, "Tag created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: createAdminTagSchema,
  }
);
