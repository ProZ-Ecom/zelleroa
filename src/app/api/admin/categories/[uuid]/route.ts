import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { categoryService } from "@/features/categories/services/category.service";
import {
  updateAdminCategorySchema,
  type UpdateAdminCategoryInput,
} from "@/features/categories/validations/admin-category.schema";
import { db } from "@/lib/db/prisma";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
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

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Category UUID is required");
      }

      const category = await categoryService.getAdminCategoryByUuid(uuid);
      return apiSuccess(category, "Category fetched successfully");
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
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
                { name: "CATEGORY_UPDATE" },
                { slug: "category-update" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Category UUID is required");
      }

      const body = context.body as UpdateAdminCategoryInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const category = await categoryService.updateAdminCategory(uuid, body, adminEmail);
      return apiSuccess(category, "Category updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateAdminCategorySchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
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
                { name: "CATEGORY_DELETE" },
                { slug: "category-delete" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Category UUID is required");
      }

      const adminEmail = context.session?.user?.email ?? undefined;
      const result = await categoryService.deleteAdminCategory(uuid, adminEmail);

      return apiSuccess(null, result.message);
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);
