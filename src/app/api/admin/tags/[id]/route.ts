import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { tagService } from "@/features/tags/services/tag.service";
import {
  updateAdminTagSchema,
  type UpdateAdminTagInput,
} from "@/features/tags/validations/admin-tag.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const id = context.params?.id;
      if (!id) throw ApiError.badRequest("Tag id is required");

      const tag = await tagService.getAdminTag(id);
      return apiSuccess(tag, "Tag fetched successfully");
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
      if (!id) throw ApiError.badRequest("Tag id is required");

      const body = context.body as UpdateAdminTagInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const tag = await tagService.updateTag(id, body, adminEmail);
      return apiSuccess(tag, "Tag updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: updateAdminTagSchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const id = context.params?.id;
      if (!id) throw ApiError.badRequest("Tag id is required");

      const result = await tagService.deleteTag(id);
      return apiSuccess(null, result.message);
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN"],
  }
);
