import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated} from "@/lib/api/api-response";
import { brandService } from "@/features/brands/services/brand.service";
import { getBrandsQuerySchema, createBrandSchema } from "@/features/brands/validations/brand.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as ReturnType<typeof getBrandsQuerySchema.parse>;
      const result = await brandService.getBrands({
        page: query.page,
        limit: query.limit,
        search: query.search,
        isActive: query.isActive,
        categorySlug: query.categorySlug,
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
