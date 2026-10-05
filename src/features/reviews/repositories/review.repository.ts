import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import type {
  CustomerReviewListInput,
  AdminReviewListInput,
  PublicReviewQueryInput,
} from "../validations/review.schema";

/** Narrowest identifier wins: exact pack, else all packs of a variant, else the whole product. */
export interface ReviewScope {
  variantUnitPriceId?: bigint;
  variantId?: bigint;
  productId?: bigint;
}

function orderItemScopeWhere(scope: ReviewScope): Prisma.OrderItemWhereInput {
  if (scope.variantUnitPriceId) return { variantUnitPriceId: scope.variantUnitPriceId };
  if (scope.variantId) return { variantId: scope.variantId };
  return { productId: scope.productId };
}

const reviewInclude = {
  product: {
    select: {
      id: true,
      uuid: true,
      name: true,
      slug: true,
    },
  },
  variant_unit_price: {
    select: {
      id: true,
      uuid: true,
      sku: true,
      variant: {
        select: {
          id: true,
          uuid: true,
          variant_name: true,
          slug: true,
        },
      },
    },
  },
  order_items: {
    select: {
      id: true,
      uuid: true,
      product_name_snapshot: true,
      variant_snapshot: true,
      sku_snapshot: true,
      quantity: true,
    },
  },
  user: {
    select: {
      id: true,
      uuid: true,
      name: true,
      email: true,
      avatar: true,
    },
  },
  images: {
    where: { is_active: true },
    select: {
      id: true,
      image_url: true,
    },
  },
};

export const reviewRepository = {
  async findProductByIdentifier(identifier: string) {
    const isNum = !isNaN(Number(identifier)) && !identifier.includes("-");
    // Storefront cards are Styles, not Products, so the id they carry is a
    // Style uuid/slug. Resolve those to the owning Product instead of 404ing -
    // reviews are stored at product level and that is what the card renders.
    const orConditions: Prisma.ProductWhereInput[] = [
      { uuid: identifier },
      { slug: identifier },
      { styles: { some: { uuid: identifier, deleted_at: null } } },
      { styles: { some: { slug: identifier, deleted_at: null } } },
    ];
    if (isNum) {
      orConditions.push({ id: BigInt(identifier) });
    }

    return db.product.findFirst({
      where: {
        OR: orConditions,
        isActive: true,
      },
      include: {
        styles: {
          where: { deleted_at: null },
          include: {
            items: {
              where: { deleted_at: null },
              include: {
                variants: {
                  where: { deleted_at: null, isActive: true },
                  include: {
                    variant_unit_prices: {
                      where: { deleted_at: null, isActive: true },
                      select: { id: true, uuid: true, sku: true },
                      orderBy: [{ is_default: "desc" as const }, { createdAt: "asc" as const }],
                      take: 1,
                    },
                  },
                  take: 1,
                },
              },
              take: 1,
            },
          },
          take: 1,
        },
      },
    });
  },

  /**
   * Resolves an item-level ProductVariant (e.g. "Mango Mysore Pak"). Used to
   * scope reviews across *all* of that variant's pack sizes.
   */
  async findVariantByIdentifier(identifier: string) {
    const isNum = !isNaN(Number(identifier)) && !identifier.includes("-");
    const orConditions: Prisma.ProductVariantWhereInput[] = [
      { uuid: identifier },
      { slug: identifier },
    ];
    if (isNum) {
      orConditions.push({ id: BigInt(identifier) });
    }

    return db.productVariant.findFirst({
      where: {
        OR: orConditions,
        isActive: true,
        deleted_at: null,
      },
      include: {
        item: {
          select: {
            id: true,
            uuid: true,
            name: true,
            slug: true,
            style: {
              select: {
                id: true,
                uuid: true,
                name: true,
                slug: true,
                product: {
                  select: {
                    id: true,
                    uuid: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        variant_unit_prices: {
          where: { deleted_at: null, isActive: true },
          select: { id: true, uuid: true, sku: true },
          orderBy: [{ is_default: "desc" as const }, { createdAt: "asc" as const }],
          take: 1,
        },
      },
    });
  },

  /**
   * Resolves an exact sellable pack size (VariantUnitPrice) — used when a
   * review needs to be scoped to the precise size a customer bought.
   */
  async findVariantUnitPriceByIdentifier(identifier: string) {
    const isNum = !isNaN(Number(identifier)) && !identifier.includes("-");
    const orConditions: Prisma.VariantUnitPriceWhereInput[] = [
      { uuid: identifier },
      { sku: identifier },
    ];
    if (isNum) {
      orConditions.push({ id: BigInt(identifier) });
    }

    return db.variantUnitPrice.findFirst({
      where: {
        OR: orConditions,
        isActive: true,
        deleted_at: null,
      },
      include: {
        variant: {
          include: {
            item: {
              include: {
                style: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        uuid: true,
                        name: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  async findOrderItemForReview(orderItemUuid: string, customerId: bigint) {
    return db.orderItem.findFirst({
      where: {
        uuid: orderItemUuid,
        is_active: true,
        order: {
          userId: customerId,
          is_active: true,
        },
      },
      include: {
        order: true,
        product: true,
        variant_unit_price: true,
      },
    });
  },

  /**
   * Delivered order items of this customer inside the scope (exact pack, variant, or product)
   * that have no active review yet, oldest first.
   */
  async findReviewableDeliveredOrderItems(scope: ReviewScope, customerId: bigint) {
    return db.orderItem.findMany({
      where: {
        ...orderItemScopeWhere(scope),
        is_active: true,
        order: { userId: customerId, is_active: true, order_status: "delivered" },
        reviews: { none: { userId: customerId, is_active: true } },
      },
      select: {
        id: true,
        productId: true,
        variantUnitPriceId: true,
        variant_unit_price: { select: { uuid: true } },
      },
      orderBy: { id: "asc" },
    });
  },

  /** Any active review by this customer inside the scope (used to tell "already reviewed" apart from "not delivered"). */
  async findActiveReviewInScope(scope: ReviewScope, customerId: bigint) {
    return db.review.findFirst({
      where: {
        userId: customerId,
        is_active: true,
        ...(scope.variantUnitPriceId
          ? { variant_unit_price_id: scope.variantUnitPriceId }
          : scope.variantId
            ? { variant_unit_price: { variant_id: scope.variantId } }
            : { productId: scope.productId }),
      },
    });
  },

  async findActiveReviewByOrderItem(orderItemId: bigint, customerId: bigint) {
    return db.review.findFirst({
      where: {
        order_item_id: orderItemId,
        userId: customerId,
        is_active: true,
      },
    });
  },

  async findActiveReviewByVariant(variantUnitPriceId: bigint, customerId: bigint) {
    return db.review.findFirst({
      where: {
        variant_unit_price_id: variantUnitPriceId,
        userId: customerId,
        is_active: true,
      },
    });
  },

  async createReviewTransaction(params: {
    productId: bigint;
    variantUnitPriceId: bigint;
    userId: bigint;
    orderItemId?: bigint | null;
    rating: number;
    title?: string;
    comment?: string;
    images?: string[];
    isApproved?: boolean;
  }) {
    const reviewUuid = crypto.randomUUID();

    return db.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          uuid: reviewUuid,
          productId: params.productId,
          variant_unit_price_id: params.variantUnitPriceId,
          userId: params.userId,
          order_item_id: params.orderItemId ?? null,
          rating: params.rating,
          title: params.title || null,
          comment: params.comment || null,
          isApproved: params.isApproved ?? false,
          is_active: true,
          created_by: params.userId,
          updated_by: params.userId,
        },
      });

      if (params.images && params.images.length > 0) {
        await tx.reviewImage.createMany({
          data: params.images.map((img) => ({
            reviewId: review.id,
            image_url: img,
            is_active: true,
            created_by: params.userId,
            updated_by: params.userId,
          })),
        });
      }

      return tx.review.findUniqueOrThrow({
        where: { id: review.id },
        include: reviewInclude,
      });
    });
  },

  async findCustomerReviews(
    customerId: bigint,
    params: CustomerReviewListInput
  ) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      userId: customerId,
      is_active: true,
    };

    if (params.isApproved !== undefined) {
      where.isApproved = params.isApproved;
    }

    if (params.rating !== undefined) {
      where.rating = params.rating;
    }

    if (params.search) {
      const s = params.search.trim();
      where.OR = [
        { title: { contains: s } },
        { comment: { contains: s } },
        { product: { name: { contains: s } } },
      ];
    }

    const sortOrder = params.sortOrder ?? "desc";
    const sortBy = params.sortBy ?? "createdAt";
    const orderBy: Prisma.ReviewOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: reviewInclude,
      }),
      db.review.count({ where }),
    ]);

    return {
      reviews,
      total,
      page,
      limit,
    };
  },

  async findCustomerReviewByUuid(uuid: string, customerId: bigint) {
    return db.review.findFirst({
      where: {
        uuid,
        userId: customerId,
        is_active: true,
      },
      include: reviewInclude,
    });
  },

  async findReviewByUuidOnly(uuid: string) {
    return db.review.findFirst({
      where: {
        uuid,
        is_active: true,
      },
      include: reviewInclude,
    });
  },

  async updateCustomerReviewTransaction(params: {
    reviewId: bigint;
    customerId: bigint;
    rating?: number;
    title?: string;
    comment?: string;
    images?: string[];
  }) {
    return db.$transaction(async (tx) => {
      const dataToUpdate: Prisma.ReviewUncheckedUpdateInput = {
        isApproved: false, // Reset approval upon customer edit
        updated_by: params.customerId,
      };

      if (params.rating !== undefined) dataToUpdate.rating = params.rating;
      if (params.title !== undefined) dataToUpdate.title = params.title || null;
      if (params.comment !== undefined) dataToUpdate.comment = params.comment || null;

      const updated = await tx.review.update({
        where: { id: params.reviewId },
        data: dataToUpdate,
      });

      if (params.images !== undefined) {
        // Soft deactivate existing active images
        await tx.reviewImage.updateMany({
          where: { reviewId: params.reviewId, is_active: true },
          data: { is_active: false, updated_by: params.customerId },
        });

        // Insert new active images
        if (params.images.length > 0) {
          await tx.reviewImage.createMany({
            data: params.images.map((img) => ({
              reviewId: params.reviewId,
              image_url: img,
              is_active: true,
              created_by: params.customerId,
              updated_by: params.customerId,
            })),
          });
        }
      }

      return tx.review.findUniqueOrThrow({
        where: { id: updated.id },
        include: reviewInclude,
      });
    });
  },

  async softDeleteReview(reviewId: bigint, updatedBy: bigint) {
    return db.review.update({
      where: { id: reviewId },
      data: {
        is_active: false,
        updated_by: updatedBy,
      },
    });
  },

  async findPublicProductReviews(
    productId: bigint,
    params: PublicReviewQueryInput
  ) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      productId,
      isApproved: true,
      is_active: true,
    };

    if (params.rating !== undefined) {
      where.rating = params.rating;
    }

    const sortOrder = params.sortOrder ?? "desc";
    const sortBy = params.sortBy ?? "createdAt";
    const orderBy: Prisma.ReviewOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              avatar: true,
            },
          },
          variant_unit_price: {
            select: {
              id: true,
              uuid: true,
              sku: true,
              variant: {
                select: {
                  id: true,
                  uuid: true,
                  variant_name: true,
                  slug: true,
                },
              },
            },
          },
          images: {
            where: { is_active: true },
            select: {
              image_url: true,
            },
          },
        },
      }),
      db.review.count({ where }),
    ]);

    return {
      reviews,
      total,
      page,
      limit,
    };
  },

  async findPublicVariantReviews(
    variantId: bigint,
    params: PublicReviewQueryInput
  ) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const skip = (page - 1) * limit;

    // Aggregate reviews across every pack size of this item-level variant.
    const where: Prisma.ReviewWhereInput = {
      variant_unit_price: { variant_id: variantId },
      isApproved: true,
      is_active: true,
    };

    if (params.rating !== undefined) {
      where.rating = params.rating;
    }

    const sortOrder = params.sortOrder ?? "desc";
    const sortBy = params.sortBy ?? "createdAt";
    const orderBy: Prisma.ReviewOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              avatar: true,
            },
          },
          variant_unit_price: {
            select: {
              id: true,
              uuid: true,
              sku: true,
              variant: {
                select: {
                  id: true,
                  uuid: true,
                  variant_name: true,
                  slug: true,
                },
              },
            },
          },
          images: {
            where: { is_active: true },
            select: {
              image_url: true,
            },
          },
        },
      }),
      db.review.count({ where }),
    ]);

    return {
      reviews,
      total,
      page,
      limit,
    };
  },

  async getPublicProductRatingSummary(productId: bigint) {
    const where: Prisma.ReviewWhereInput = {
      productId,
      isApproved: true,
      is_active: true,
    };

    const [agg, ratingGroups] = await Promise.all([
      db.review.aggregate({
        where,
        _avg: { rating: true },
        _count: { id: true },
      }),
      db.review.groupBy({
        by: ["rating"],
        where,
        _count: { id: true },
      }),
    ]);

    const breakdown = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
    };

    ratingGroups.forEach((g) => {
      const key = String(g.rating) as keyof typeof breakdown;
      if (key in breakdown) {
        breakdown[key] = g._count.id;
      }
    });

    const averageRating = agg._avg.rating
      ? Math.round(agg._avg.rating * 10) / 10
      : 0;

    return {
      averageRating,
      totalReviews: agg._count.id,
      ratingBreakdown: breakdown,
    };
  },

  async getPublicVariantRatingSummary(variantId: bigint) {
    const where: Prisma.ReviewWhereInput = {
      variant_unit_price: { variant_id: variantId },
      isApproved: true,
      is_active: true,
    };

    const [agg, ratingGroups] = await Promise.all([
      db.review.aggregate({
        where,
        _avg: { rating: true },
        _count: { id: true },
      }),
      db.review.groupBy({
        by: ["rating"],
        where,
        _count: { id: true },
      }),
    ]);

    const breakdown = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
    };

    ratingGroups.forEach((g) => {
      const key = String(g.rating) as keyof typeof breakdown;
      if (key in breakdown) {
        breakdown[key] = g._count.id;
      }
    });

    const averageRating = agg._avg.rating
      ? Math.round(agg._avg.rating * 10) / 10
      : 0;

    return {
      averageRating,
      totalReviews: agg._count.id,
      ratingBreakdown: breakdown,
    };
  },

  async findAdminReviews(
    params: AdminReviewListInput,
    resolvedProductId?: bigint,
    resolvedVariantId?: bigint,
    resolvedVariantUnitPriceId?: bigint
  ) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      is_active: true,
    };

    if (resolvedProductId) {
      where.productId = resolvedProductId;
    }

    if (resolvedVariantUnitPriceId) {
      // Exact pack size takes precedence over the item-level filter.
      where.variant_unit_price_id = resolvedVariantUnitPriceId;
    } else if (resolvedVariantId) {
      where.variant_unit_price = { variant_id: resolvedVariantId };
    }

    if (params.isApproved !== undefined) {
      where.isApproved = params.isApproved;
    }

    if (params.rating !== undefined) {
      where.rating = params.rating;
    }

    if (params.search) {
      const s = params.search.trim();
      where.OR = [
        { title: { contains: s } },
        { comment: { contains: s } },
        { product: { name: { contains: s } } },
        { variant_unit_price: { variant: { variant_name: { contains: s } } } },
        { variant_unit_price: { sku: { contains: s } } },
        { user: { name: { contains: s } } },
        { user: { email: { contains: s } } },
      ];
    }

    const sortOrder = params.sortOrder ?? "desc";
    const sortBy = params.sortBy ?? "createdAt";
    const orderBy: Prisma.ReviewOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: reviewInclude,
      }),
      db.review.count({ where }),
    ]);

    return {
      reviews,
      total,
      page,
      limit,
    };
  },

  async moderateReviewStatus(
    reviewId: bigint,
    isApproved: boolean,
    adminId: bigint
  ) {
    return db.review.update({
      where: { id: reviewId },
      data: {
        isApproved,
        updated_by: adminId,
      },
      include: reviewInclude,
    });
  },
};
