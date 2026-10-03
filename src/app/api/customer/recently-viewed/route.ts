import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { recentlyViewedService } from "@/features/customers/services/recently-viewed.service";
import {
  recordRecentlyViewedSchema,
  recentlyViewedQuerySchema,
  type RecordRecentlyViewedInput,
  type RecentlyViewedQueryInput,
} from "@/features/customers/validations/catalog.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Please login to view your recently viewed products");
      }

      const query = context.query as RecentlyViewedQueryInput;
      const result = await recentlyViewedService.getRecentlyViewed(
        sessionUserId,
        query?.exclude,
        query?.limit ?? 8
      );
      return apiSuccess(result, "Recently viewed products fetched successfully", 200);
    },
  },
  {
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    querySchema: recentlyViewedQuerySchema,
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Please login to track recently viewed products");
      }

      const body = context.body as RecordRecentlyViewedInput;
      const result = await recentlyViewedService.recordView(sessionUserId, body.productId);
      return apiSuccess(result, "View recorded", 200);
    },
  },
  {
    method: "POST",
    requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"],
    bodySchema: recordRecentlyViewedSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
  }
);
