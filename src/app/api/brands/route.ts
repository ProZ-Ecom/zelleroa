import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated, apiError } from "@/lib/api/api-response";
import { brandService } from "@/features/brands/services/brand.service";
import { getBrandsQuerySchema, createBrandSchema } from "@/features/brands/validations/brand.schema";
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
                { name: "BRAND_LIST" },
                { slug: "brand-list" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const query = context.query as ReturnType<typeof getBrandsQuerySchema.parse>;
      const result = await brandService.getBrands({
        page: query.page,
        limit: query.limit,
        search: query.search,
        isActive: query.isActive,
      });
      return apiSuccess(result.data, "Brands fetched successfully", 200, result.meta);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    querySchema: getBrandsQuerySchema,
  }
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
                { name: "BRAND_CREATE" },
                { slug: "brand-create" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const body = context.body as ReturnType<typeof createBrandSchema.parse>;
      const brand = await brandService.createBrand(body);
      return apiCreated(brand, "Brand created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: createBrandSchema,
  }
);
