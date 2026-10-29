import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { variantService } from "@/features/variants/services/variant.service";
import {
  adminVariantListSchema,
  type AdminVariantListInput,
} from "@/features/variants/validations/admin-variant.schema";
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
                { name: "COLORS_LIST" },
                { slug: "colors-list" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const body = (context.body || {}) as AdminVariantListInput;
      const result = await variantService.getAllAdminVariants(body);

      return apiSuccess(result.data, "Variants fetched successfully", 200, result.meta);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: adminVariantListSchema,
  }
);