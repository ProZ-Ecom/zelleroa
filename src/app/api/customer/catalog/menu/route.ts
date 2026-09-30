import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { catalogListingService } from "@/features/customers/services/catalog-listing.service";

/**
 * Header menu preview: `?category=<slug|uuid>` -> the Products under that
 * category (and its subcategories), each with its Items.
 */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const categoryKey = context.searchParams?.get("category")?.trim().slice(0, 170);
      if (!categoryKey) throw ApiError.badRequest("category is required");
      const genderParam = context.searchParams?.get("gender")?.trim().toLowerCase();
      const gender = (["men", "women", "kids", "unisex"] as const).find((g) => g === genderParam);
      const menu = await catalogListingService.getCategoryMenu({
        categoryKey,
        gender,
        productLimit: 6,
        itemLimit: 4,
      });
      return apiSuccess(menu, "Category menu fetched successfully");
    },
  },
  {
    // Fired on header hover.
    rateLimit: { limit: 240, windowMs: 60_000 },
  }
);
