import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { productService } from "@/features/products/services/product.service";
import {
  adminProductListSchema,
  type AdminProductListInput,
} from "@/features/products/validations/admin-product.schema";
import { db } from "@/lib/db/prisma";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const userRole = context.session?.user?.role;
      if (userRole !== "ADMIN") {
        const hasPermission = await db.rolePermission.findFirst({
          where: {
            role: { name: userRole },
            permission: {
              OR: [
                { name: "PRODUCT_VIEW" },
                { slug: "product-view" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const body = (context.body || {}) as AdminProductListInput;
      const result = await productService.getAdminProductsList(body);

      return apiSuccess(
        result.data,
        "Products fetched successfully",
        200,
        result.meta
      );
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: adminProductListSchema,
  }
);
