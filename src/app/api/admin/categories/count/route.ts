import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess} from "@/lib/api/api-response";
import { categoryService } from "@/features/categories/services/category.service";
import {
  adminCategoryListSchema,
  type AdminCategoryListInput,
} from "@/features/categories/validations/admin-category.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = (context.body || {}) as AdminCategoryListInput;
      const result = await categoryService.countAdminCategories(body);

      return apiSuccess(result, "Categories count fetched successfully", 200);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: adminCategoryListSchema,
  }
);
