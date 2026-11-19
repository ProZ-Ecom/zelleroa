import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { reviewService } from "@/features/reviews/services/review.service";
import {
  reviewEligibilityQuerySchema,
  type ReviewEligibilityQueryInput,
} from "@/features/reviews/validations/review.schema";

// Guests are allowed through (optionalAuth) and get `login_required`, so the page can
// decide between a sign-in prompt and hiding the review option.
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as ReviewEligibilityQueryInput;
      const result = await reviewService.getReviewEligibility(
        context.session?.user?.id,
        query
      );
      return apiSuccess(result, "Review eligibility fetched successfully");
    },
  },
  {
    optionalAuth: true,
    querySchema: reviewEligibilityQuerySchema,
  }
);
