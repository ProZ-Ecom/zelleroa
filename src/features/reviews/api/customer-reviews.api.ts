import { apiClient } from "@/lib/api/api-client";
import type { CreateReviewInput } from "../validations/review.schema";
import type { ReviewResponse } from "../types/review.types";

export interface ReviewEligibility {
  eligible: boolean;
  reason: "login_required" | "not_delivered" | "already_reviewed" | "invalid_target" | null;
  message: string;
  /** Pack sizes (variant unit price UUIDs) with a delivered, not-yet-reviewed order item. */
  eligibleUnitPriceIds: string[];
}

export const customerReviewsApi = {
  /**
   * Whether the current viewer may review the target
   * GET /api/customer/reviews/eligibility
   */
  async getEligibility(params: {
    variantId?: string | null;
    productId?: string | null;
  }): Promise<ReviewEligibility> {
    const response = await apiClient.get<ReviewEligibility>(
      "/api/customer/reviews/eligibility",
      {
        params: {
          variantId: params.variantId ?? undefined,
          productId: params.variantId ? undefined : params.productId ?? undefined,
        },
      }
    );
    return response.data!;
  },

  /**
   * Submit a customer review for a variant / order item
   * POST /api/customer/reviews
   */
  async submitReview(data: CreateReviewInput): Promise<ReviewResponse> {
    const response = await apiClient.post<ReviewResponse>(
      "/api/customer/reviews",
      data
    );
    return response.data!;
  },
};
