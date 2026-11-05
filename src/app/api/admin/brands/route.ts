import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated} from "@/lib/api/api-response";
import { brandService } from "@/features/brands/services/brand.service";
import {
  createAdminBrandSchema,
  adminBrandsQuerySchema,
  type CreateAdminBrandInput,
  type AdminBrandsQueryInput,
} from "@/features/brands/validations/admin-brand.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as AdminBrandsQueryInput;
      const result = await brandService.getAdminBrands({
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 10,
        search: query?.search,
      });

      return apiSuccess(result.data, "Brands fetched successfully", 200, result.meta);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    querySchema: adminBrandsQuerySchema,
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as CreateAdminBrandInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const brand = await brandService.createAdminBrand(body, adminEmail);

      return apiCreated(brand, "Brand created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: createAdminBrandSchema,
  }
);
