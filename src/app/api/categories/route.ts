import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated, apiError } from "@/lib/api/api-response";
import { categoryService } from "@/features/categories/services/category.service";
import { getCategoriesQuerySchema, createCategorySchema } from "@/features/categories/validations/category.schema";
import { db } from "@/lib/db/prisma";

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
      const rawRole = (context.session?.user as { role?: string })?.role;
      const userRole = rawRole?.toUpperCase();
      if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
        const hasPermission = await db.rolePermission.findFirst({
          where: {
            role: {
              OR: [
                ...(userRole ? [{ name: userRole }] : []),
                ...(rawRole ? [{ name: rawRole }, { slug: rawRole.toLowerCase() }] : []),
              ],
            },
            permission: {
              OR: [
                { name: "CATEGORY_CREATE" },
                { slug: "category-create" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

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
