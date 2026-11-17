import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { catalogService } from "@/features/customers/services/catalog.service";
import type { CustomerGlobalSearchInput } from "@/features/customers/validations/catalog.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const q = ((context.query?.q as string) || context.searchParams?.get("q") || "").trim();
      if (!q) {
        return apiSuccess(
          {
            query: "",
            products: [],
            categories: [],
            brands: [],
            totalMatches: 0,
          },
          "Search query is empty"
        );
      }

      const productLimit = Number(context.query?.productLimit || context.searchParams?.get("productLimit")) || 6;
      const categoryLimit = Number(context.query?.categoryLimit || context.searchParams?.get("categoryLimit")) || 4;
      const brandLimit = Number(context.query?.brandLimit || context.searchParams?.get("brandLimit")) || 4;

      const result = await catalogService.globalSearch({
        query: q,
        productLimit,
        categoryLimit,
        brandLimit,
      });

      return apiSuccess(result, "Global search results fetched successfully");
    },
  },
  {
    // Fast debounced searches from storefront search input
    rateLimit: { limit: 240, windowMs: 60_000 },
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = (context.body || {}) as Partial<CustomerGlobalSearchInput>;
      const q = (body.q || "").trim();
      if (!q) {
        return apiSuccess(
          {
            query: "",
            products: [],
            categories: [],
            brands: [],
            totalMatches: 0,
          },
          "Search query is empty"
        );
      }

      const result = await catalogService.globalSearch({
        query: q,
        productLimit: body.productLimit ?? 6,
        categoryLimit: body.categoryLimit ?? 4,
        brandLimit: body.brandLimit ?? 4,
      });

      return apiSuccess(result, "Global search results fetched successfully");
    },
  },
  {
    rateLimit: { limit: 240, windowMs: 60_000 },
  }
);
