import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated} from "@/lib/api/api-response";
import { categoryService } from "@/features/categories/services/category.service";
import { getCategoriesQuerySchema, createCategorySchema } from "@/features/categories/validations/category.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as ReturnType<typeof getCategoriesQuerySchema.parse>;
      const categories = await categoryService.getCategories({
        search: query.search,
        parentId: query.parentId,
      });
      return apiSuccess(categories, "Categories fetched successfully");
    },
  },
  { querySchema: getCategoriesQuerySchema }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as ReturnType<typeof createCategorySchema.parse>;
      const category = await categoryService.createCategory(body);
      return apiCreated(category, "Category created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: createCategorySchema,
  }
);
