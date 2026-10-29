import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { brandService } from "@/features/brands/services/brand.service";
import { updateBrandSchema } from "@/features/brands/validations/brand.schema";
import { db } from "@/lib/db/prisma";

export const GET = createApiHandler({
  GET: async (_request, context) => {
    const id = context.params?.id;
    if (!id) return apiError("Brand ID is required", 400);
    const brand = await brandService.getBrand(id);
    return apiSuccess(brand, "Brand fetched successfully");
  },
});

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
                { name: "BRAND_UPDATE" },
                { slug: "brand-update" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const id = context.params?.id;
      if (!id) return apiError("Brand ID is required", 400);
      const body = context.body as ReturnType<typeof updateBrandSchema.parse>;
      const brand = await brandService.updateBrand(parseInt(id), body);
      return apiSuccess(brand, "Brand updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateBrandSchema,
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
                { name: "BRAND_DELETE" },
                { slug: "brand-delete" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const id = context.params?.id;
      if (!id) return apiError("Brand ID is required", 400);
      await brandService.deleteBrand(parseInt(id));
      return apiSuccess(null, "Brand deleted successfully");
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);
