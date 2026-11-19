import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { tagService } from "@/features/tags/services/tag.service";
import {
  assignTagProductsSchema,
  type AssignTagProductsInput,
} from "@/features/tags/validations/admin-tag.schema";

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const id = context.params?.id;
      if (!id) throw ApiError.badRequest("Tag id is required");

      const body = context.body as AssignTagProductsInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const tag = await tagService.assignProducts(id, body, adminEmail);
      return apiSuccess(tag, "Tag products updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: assignTagProductsSchema,
  }
);
