import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { categoryService } from "@/features/categories/services/category.service";
import { updateCategorySchema } from "@/features/categories/validations/category.schema";

export const GET = createApiHandler({
  GET: async (_request, context) => {
    const id = context.params?.id;
    if (!id) return apiError("Category ID is required", 400);
    const category = await categoryService.getCategory(id);
    return apiSuccess(category, "Category fetched successfully");
  },
});

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const id = context.params?.id;
      if (!id) return apiError("Category ID is required", 400);
      const body = context.body as ReturnType<typeof updateCategorySchema.parse>;
      const category = await categoryService.updateCategory(parseInt(id), body);
      return apiSuccess(category, "Category updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateCategorySchema,
  }
);

export const DELETE = createApiHandler({
  DELETE: async (_request, context) => {
    const id = context.params?.id;
    if (!id) return apiError("Category ID is required", 400);
    await categoryService.deleteCategory(parseInt(id));
    return apiSuccess(null, "Category deleted successfully");
  },
}, {
  method: "DELETE",
  requireAuth: true,
  requiredRole: ["ADMIN", "STAFF"],
});
