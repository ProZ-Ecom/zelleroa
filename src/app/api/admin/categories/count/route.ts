import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { categoryService } from "@/features/categories/services/category.service";
import {
  adminCategoryListSchema,
  type AdminCategoryListInput,
} from "@/features/categories/validations/admin-category.schema";
import { db } from "@/lib/db/prisma";

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
                { name: "CATEGORY_VIEW" },
                { slug: "category-view" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

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
