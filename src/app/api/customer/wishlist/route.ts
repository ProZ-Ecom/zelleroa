import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { wishlistService } from "@/features/wishlist/services/wishlist.service";
import {
  addWishlistSchema,
  type AddWishlistInput,
} from "@/features/wishlist/validations/wishlist.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Please login to view your wishlist");
      }

      const result = await wishlistService.getCustomerWishlist(sessionUserId);
      return apiSuccess(result, "Wishlist fetched successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Please login to add to your wishlist");
      }

      try {
        const body = context.body as AddWishlistInput;
        console.log("Adding to wishlist with user:", sessionUserId, "body:", body);
        const result = await wishlistService.addToWishlist(sessionUserId, body);
        return apiSuccess(result, "Added to wishlist successfully", 200);
      } catch (err) {
        console.error("WISHLIST ROUTE ERROR:", err);
        throw err;
      }
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    bodySchema: addWishlistSchema,
  }
);
