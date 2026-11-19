"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerReviewsApi } from "../api/customer-reviews.api";
import type { CreateReviewInput } from "../validations/review.schema";
import type { ReviewResponse } from "../types/review.types";

interface UseSubmitCustomerReviewOptions {
  variantId?: string | null;
  productId?: string | null;
  onSuccess?: (data: ReviewResponse) => void;
  onError?: (error: any) => void;
}

export function useReviewEligibility(params: {
  variantId?: string | null;
  productId?: string | null;
}) {
  const target = params.variantId || params.productId;
  return useQuery({
    queryKey: ["reviews", "eligibility", params.variantId ?? null, params.productId ?? null],
    queryFn: () => customerReviewsApi.getEligibility(params),
    enabled: Boolean(target),
    staleTime: 1000 * 30,
  });
}

export function useSubmitCustomerReview(options?: UseSubmitCustomerReviewOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReviewInput) => customerReviewsApi.submitReview(data),
    onSuccess: (data) => {
      // Invalidate both variant and product review queries to reflect immediately
      if (options?.variantId) {
        queryClient.invalidateQueries({
          queryKey: ["variants", options.variantId, "reviews"],
        });
      }
      if (options?.productId) {
        queryClient.invalidateQueries({
          queryKey: ["products", options.productId, "reviews"],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["variants"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}
