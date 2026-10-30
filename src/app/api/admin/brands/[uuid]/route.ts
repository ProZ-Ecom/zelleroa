import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { brandService } from "@/features/brands/services/brand.service";
import {
  updateAdminBrandSchema,
  type UpdateAdminBrandInput,
} from "@/features/brands/validations/admin-brand.schema";
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

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Brand UUID is required");
      }

      const brand = await brandService.getAdminBrandByUuid(uuid);
      return apiSuccess(brand, "Brand fetched successfully");
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

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Brand UUID is required");
      }

      const body = context.body as UpdateAdminBrandInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const brand = await brandService.updateAdminBrand(uuid, body, adminEmail);
      return apiSuccess(brand, "Brand updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateAdminBrandSchema,
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

      const uuid = context.params?.uuid;
      if (!uuid) {
        throw ApiError.badRequest("Brand UUID is required");
      }

      const adminEmail = context.session?.user?.email ?? undefined;
      const result = await brandService.deleteAdminBrand(uuid, adminEmail);

      return apiSuccess(null, result.message);
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);
