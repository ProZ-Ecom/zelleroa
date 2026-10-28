import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated, apiError } from "@/lib/api/api-response";
import { productService } from "@/features/products/services/product.service";
import {
  createAdminProductSchema,
  adminProductsQuerySchema,
  type CreateAdminProductInput,
  type AdminProductsQueryInput,
} from "@/features/products/validations/admin-product.schema";
import { db } from "@/lib/db/prisma";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
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

      const query = context.query as AdminProductsQueryInput;
      const result = await productService.getAdminProducts({
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 10,
        search: query?.search
      });

      return apiSuccess(result.data, "Products fetched successfully", 200, result.meta);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    querySchema: adminProductsQuerySchema,
  }
);

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
                { name: "PRODUCT_CREATE" },
                { slug: "product-create" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const body = context.body as CreateAdminProductInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const product = await productService.createAdminProduct(body, adminEmail);

      return apiCreated(product, "Product created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: createAdminProductSchema,
  }
);
