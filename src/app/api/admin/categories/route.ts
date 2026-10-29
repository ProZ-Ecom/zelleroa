import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { categoryService } from "@/features/categories/services/category.service";
import {
  createAdminCategorySchema,
  adminCategoriesQuerySchema,
  type CreateAdminCategoryInput,
  type AdminCategoriesQueryInput,
} from "@/features/categories/validations/admin-category.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as AdminCategoriesQueryInput;
      const result = await categoryService.getAdminCategories({
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 10,
        search: query?.search,
        isActive: query?.isActive,
        parentId: query?.parentId,
      });

      return apiSuccess(result.data, "Categories fetched successfully", 200, result.meta);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    querySchema: adminCategoriesQuerySchema,
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as CreateAdminCategoryInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const category = await categoryService.createAdminCategory(body, adminEmail);

      return apiCreated(category, "Category created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: createAdminCategorySchema,
  }
);
