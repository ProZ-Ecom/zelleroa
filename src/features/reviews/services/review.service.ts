import { ApiError } from "@/lib/api/api-error";
import { reviewRepository } from "../repositories/review.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import type {
  CreateReviewInput,
  UpdateReviewInput,
  CustomerReviewListInput,
  AdminReviewListInput,
  PublicReviewQueryInput,
  ModerateReviewInput,
} from "../validations/review.schema";
import type {
  ReviewResponse,
  PublicReviewItem,
  ReviewModerateResult,
} from "../types/review.types";

function formatReviewResponse(review: any): ReviewResponse {
  return {
    id: review.uuid || String(review.id),
    productId: review.product?.uuid || String(review.productId),
    variantId:
      review.variant_unit_price?.variant?.uuid ||
      (review.variant_unit_price_id ? String(review.variant_unit_price_id) : null),
    variantUnitPriceId:
      review.variant_unit_price?.uuid ||
      (review.variant_unit_price_id ? String(review.variant_unit_price_id) : null),
    orderItemId: review.order_items?.uuid || (review.order_item_id ? String(review.order_item_id) : null),
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    images: (review.images || []).map((img: any) => img.image_url),
    isApproved: review.isApproved,
    product: review.product
      ? {
          id: review.product.uuid || String(review.product.id),
          name: review.product.name,
          slug: review.product.slug,
        }
      : undefined,
    variant: review.variant_unit_price
      ? {
          id: review.variant_unit_price.variant?.uuid || String(review.variant_unit_price.variant?.id),
          name: review.variant_unit_price.variant?.variant_name || review.variant_unit_price.sku,
          sku: review.variant_unit_price.sku,
          slug: review.variant_unit_price.variant?.slug,
        }
      : undefined,
    orderItem: review.order_items
      ? {
          id: review.order_items.uuid || String(review.order_items.id),
          productNameSnapshot: review.order_items.product_name_snapshot,
          variantSnapshot: review.order_items.variant_snapshot,
          skuSnapshot: review.order_items.sku_snapshot,
          quantity: review.order_items.quantity,
        }
      : undefined,
    customer: review.user
      ? {
          id: review.user.uuid || String(review.user.id),
          name: review.user.name,
          avatar: review.user.avatar ?? null,
        }
      : undefined,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

async function resolveActiveCustomer(sessionUserId: string) {
  const customer = await userRepository.findById(sessionUserId);
  if (!customer) {
    throw ApiError.unauthorized("Customer not found");
  }
  if (!customer.isActive || customer.is_active === false) {
    throw ApiError.accountBlocked("Your account is inactive or blocked. Please contact support.");
  }
  return customer;
}

export const reviewService = {
  async createCustomerReview(
    sessionUserId: string,
    input: CreateReviewInput
  ): Promise<ReviewResponse> {
    // 1. Resolve Customer
    const customer = await resolveActiveCustomer(sessionUserId);
    const customerId = BigInt(customer.internalId || customer.id);

    let productId: bigint;
    let variantUnitPriceId: bigint;
    let orderItemId: bigint | null = null;

    if (input.orderItemId) {
      // Order Item Review Flow (Verified delivered purchase)
      const orderItem = await reviewRepository.findOrderItemForReview(
        input.orderItemId,
        customerId
      );

      if (!orderItem) {
        throw ApiError.badRequest(
          "Order item not found or does not belong to your orders"
        );
      }

      if (orderItem.order.order_status !== "delivered") {
        throw ApiError.badRequest(
          `Cannot review items from order with status '${orderItem.order.order_status}'. Only delivered orders can be reviewed.`
        );
      }

      if (
        input.variantUnitPriceId &&
        orderItem.variant_unit_price &&
        orderItem.variant_unit_price.uuid !== input.variantUnitPriceId
      ) {
        throw ApiError.badRequest(
          "The selected pack size does not match the one purchased in the order item"
        );
      }

      const existingActive = await reviewRepository.findActiveReviewByOrderItem(
        orderItem.id,
        customerId
      );
      if (existingActive) {
        throw ApiError.conflict(
          "You have already submitted a review for this order item"
        );
      }

      productId = orderItem.productId;
      variantUnitPriceId = orderItem.variantUnitPriceId!;
      orderItemId = orderItem.id;
    } else {
      // Storefront Product / Variant Review Flow
      let unitPrice = null;

      if (input.variantUnitPriceId) {
        unitPrice = await reviewRepository.findVariantUnitPriceByIdentifier(
          input.variantUnitPriceId
        );
      } else if (input.variantId) {
        const variant = await reviewRepository.findVariantByIdentifier(input.variantId);
        if (variant && variant.variant_unit_prices?.length > 0) {
          unitPrice = await reviewRepository.findVariantUnitPriceByIdentifier(
            variant.variant_unit_prices[0].uuid || String(variant.variant_unit_prices[0].id)
          );
        }
      } else if (input.productId) {
        const product = await reviewRepository.findProductByIdentifier(input.productId);
        const firstVariant = (product as any)?.styles?.[0]?.items?.[0]?.variants?.[0];
        if (firstVariant && firstVariant.variant_unit_prices?.length > 0) {
          unitPrice = await reviewRepository.findVariantUnitPriceByIdentifier(
            firstVariant.variant_unit_prices[0].uuid || String(firstVariant.variant_unit_prices[0].id)
          );
        }
      }

      if (!unitPrice) {
        throw ApiError.badRequest(
          "Valid product variant or pack size is required to submit a review"
        );
      }

      productId = unitPrice.variant.item.style.productId;
      variantUnitPriceId = unitPrice.id;

      // Duplicate prevention: 1 review per customer per variant pack
      const existingActive = await reviewRepository.findActiveReviewByVariant(
        variantUnitPriceId,
        customerId
      );
      if (existingActive) {
        throw ApiError.conflict(
          "You have already submitted a review for this snack"
        );
      }
    }

    // Create Review Transaction
    const created = await reviewRepository.createReviewTransaction({
      productId,
      variantUnitPriceId,
      userId: customerId,
      orderItemId,
      rating: input.rating,
      title: input.title || undefined,
      comment: input.comment || undefined,
      images: input.images,
      isApproved: false, // Requires admin approval before appearing publicly
    });

    return formatReviewResponse(created);
  },

  async getCustomerReviews(
    sessionUserId: string,
    params: CustomerReviewListInput
  ) {
    const customer = await resolveActiveCustomer(sessionUserId);
    const customerId = BigInt(customer.internalId || customer.id);

    const result = await reviewRepository.findCustomerReviews(
      customerId,
      params
    );

    const data = result.reviews.map(formatReviewResponse);

    return {
      data,
      meta: {
        page: result.page,
        limit: result.limit,
        pageSize: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit) || 1,
      },
    };
  },

  async getCustomerReviewByUuid(
    sessionUserId: string,
    uuid: string
  ): Promise<ReviewResponse> {
    const customer = await resolveActiveCustomer(sessionUserId);
    const customerId = BigInt(customer.internalId || customer.id);

    const review = await reviewRepository.findCustomerReviewByUuid(
      uuid,
      customerId
    );

    if (!review) {
      const anyReview = await reviewRepository.findReviewByUuidOnly(uuid);
      if (anyReview) {
        throw ApiError.forbidden("You do not have access to this review");
      }
      throw ApiError.notFound("Review not found");
    }

    return formatReviewResponse(review);
  },

  async updateCustomerReview(
    sessionUserId: string,
    uuid: string,
    input: UpdateReviewInput
  ): Promise<ReviewResponse> {
    const customer = await resolveActiveCustomer(sessionUserId);
    const customerId = BigInt(customer.internalId || customer.id);

    const existing = await reviewRepository.findCustomerReviewByUuid(
      uuid,
      customerId
    );

    if (!existing) {
      const anyReview = await reviewRepository.findReviewByUuidOnly(uuid);
      if (anyReview) {
        throw ApiError.forbidden("You do not have access to this review");
      }
      throw ApiError.notFound("Review not found");
    }

    const updated = await reviewRepository.updateCustomerReviewTransaction({
      reviewId: existing.id,
      customerId,
      rating: input.rating,
      title: input.title || undefined,
      comment: input.comment || undefined,
      images: input.images,
    });

    return formatReviewResponse(updated);
  },

  async deleteCustomerReview(
    sessionUserId: string,
    uuid: string
  ): Promise<void> {
    const customer = await resolveActiveCustomer(sessionUserId);
    const customerId = BigInt(customer.internalId || customer.id);

    const existing = await reviewRepository.findCustomerReviewByUuid(
      uuid,
      customerId
    );

    if (!existing) {
      const anyReview = await reviewRepository.findReviewByUuidOnly(uuid);
      if (anyReview) {
        throw ApiError.forbidden("You do not have access to this review");
      }
      throw ApiError.notFound("Review not found");
    }

    await reviewRepository.softDeleteReview(existing.id, customerId);
  },

  async getPublicVariantReviews(
    identifier: string,
    params: PublicReviewQueryInput
  ) {
    // Public variant page shows reviews aggregated across all pack sizes.
    const variant = await reviewRepository.findVariantByIdentifier(identifier);
    if (!variant) {
      throw ApiError.notFound("Product variant not found");
    }

    const [reviewsResult, ratingSummary] = await Promise.all([
      reviewRepository.findPublicVariantReviews(variant.id, params),
      reviewRepository.getPublicVariantRatingSummary(variant.id),
    ]);

    const publicReviews: PublicReviewItem[] = reviewsResult.reviews.map((r) => ({
      id: r.uuid || String(r.id),
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      images: (r.images || []).map((img: any) => img.image_url),
      customerName: r.user.name,
      customerAvatar: r.user.avatar ?? null,
      variant: r.variant_unit_price
        ? {
            id: r.variant_unit_price.variant?.uuid || String(r.variant_unit_price.variant?.id),
            name: r.variant_unit_price.variant?.variant_name || r.variant_unit_price.sku,
            sku: r.variant_unit_price.sku,
            slug: r.variant_unit_price.variant?.slug,
          }
        : undefined,
      createdAt: r.createdAt,
    }));

    const defaultSku = variant.variant_unit_prices?.[0]?.sku;

    return {
      variant: {
        id: variant.uuid || String(variant.id),
        name: variant.variant_name || defaultSku,
        sku: defaultSku,
        slug: variant.slug,
        product: {
          id: variant.item.style.product.uuid || String(variant.item.style.product.id),
          name: variant.item.style.product.name,
          slug: variant.item.style.product.slug,
        },
      },
      reviews: publicReviews,
      ratingSummary,
      meta: {
        page: reviewsResult.page,
        limit: reviewsResult.limit,
        pageSize: reviewsResult.limit,
        total: reviewsResult.total,
        totalPages: Math.ceil(reviewsResult.total / reviewsResult.limit) || 1,
      },
    };
  },

  async getPublicProductReviews(
    identifier: string,
    params: PublicReviewQueryInput
  ) {
    const product = await reviewRepository.findProductByIdentifier(identifier);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }

    const [reviewsResult, ratingSummary] = await Promise.all([
      reviewRepository.findPublicProductReviews(product.id, params),
      reviewRepository.getPublicProductRatingSummary(product.id),
    ]);

    const publicReviews: PublicReviewItem[] = reviewsResult.reviews.map((r) => ({
      id: r.uuid || String(r.id),
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      images: (r.images || []).map((img: any) => img.image_url),
      customerName: r.user.name,
      customerAvatar: r.user.avatar ?? null,
      variant: r.variant_unit_price
        ? {
            id: r.variant_unit_price.variant?.uuid || String(r.variant_unit_price.variant?.id),
            name: r.variant_unit_price.variant?.variant_name || r.variant_unit_price.sku,
            sku: r.variant_unit_price.sku,
            slug: r.variant_unit_price.variant?.slug,
          }
        : undefined,
      createdAt: r.createdAt,
    }));

    return {
      reviews: publicReviews,
      ratingSummary,
      meta: {
        page: reviewsResult.page,
        limit: reviewsResult.limit,
        pageSize: reviewsResult.limit,
        total: reviewsResult.total,
        totalPages: Math.ceil(reviewsResult.total / reviewsResult.limit) || 1,
      },
    };
  },

  async getAdminReviews(params: AdminReviewListInput) {
    let resolvedProductId: bigint | undefined;
    let resolvedVariantId: bigint | undefined;
    let resolvedVariantUnitPriceId: bigint | undefined;

    if (params.productId) {
      const product = await reviewRepository.findProductByIdentifier(params.productId);
      if (product) {
        resolvedProductId = product.id;
      }
    }

    if (params.variantId) {
      const variant = await reviewRepository.findVariantByIdentifier(params.variantId);
      if (variant) {
        resolvedVariantId = variant.id;
      }
    }

    if (params.variantUnitPriceId) {
      const unitPrice = await reviewRepository.findVariantUnitPriceByIdentifier(
        params.variantUnitPriceId
      );
      if (unitPrice) {
        resolvedVariantUnitPriceId = unitPrice.id;
      }
    }

    const result = await reviewRepository.findAdminReviews(
      params,
      resolvedProductId,
      resolvedVariantId,
      resolvedVariantUnitPriceId
    );
    const data = result.reviews.map(formatReviewResponse);

    return {
      data,
      meta: {
        page: result.page,
        limit: result.limit,
        pageSize: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit) || 1,
      },
    };
  },

  async getAdminReviewByUuid(uuid: string): Promise<ReviewResponse> {
    const review = await reviewRepository.findReviewByUuidOnly(uuid);
    if (!review) {
      throw ApiError.notFound("Review not found");
    }

    return formatReviewResponse(review);
  },

  async moderateReview(
    adminSessionUserId: string,
    uuid: string,
    input: ModerateReviewInput
  ): Promise<ReviewModerateResult> {
    const admin = await userRepository.findById(adminSessionUserId);
    if (!admin) {
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }
    const adminId = BigInt(admin.internalId || admin.id);

    const review = await reviewRepository.findReviewByUuidOnly(uuid);
    if (!review) {
      throw ApiError.notFound("Review not found");
    }

    const updated = await reviewRepository.moderateReviewStatus(
      review.id,
      input.isApproved,
      adminId
    );

    return {
      id: updated.uuid || String(updated.id),
      isApproved: updated.isApproved,
      updatedAt: updated.updatedAt,
    };
  },

  async deleteAdminReview(
    adminSessionUserId: string,
    uuid: string
  ): Promise<void> {
    const admin = await userRepository.findById(adminSessionUserId);
    if (!admin) {
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }
    const adminId = BigInt(admin.internalId || admin.id);

    const review = await reviewRepository.findReviewByUuidOnly(uuid);
    if (!review) {
      throw ApiError.notFound("Review not found");
    }

    await reviewRepository.softDeleteReview(review.id, adminId);
  },
};
