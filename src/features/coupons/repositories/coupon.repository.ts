import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import type { GetCouponsParams, CouponListItem } from "../types";

function toCouponListItem(coupon: Record<string, unknown>): CouponListItem {
  const count =
    (coupon._count as { coupon_usage?: number } | undefined)?.coupon_usage ??
    coupon.usedCount ??
    0;

  return {
    id: Number(coupon.id),
    code: coupon.code as string,
    type: coupon.type as string,
    value: Number(coupon.value),
    minOrderAmount: coupon.minOrderAmount != null ? Number(coupon.minOrderAmount) : null,
    maxDiscount: (coupon.maxDiscount ?? coupon.max_discount_amount) != null ? Number(coupon.maxDiscount ?? coupon.max_discount_amount) : null,
    usageLimit: (coupon.usageLimit ?? coupon.usage_limit) != null ? Number(coupon.usageLimit ?? coupon.usage_limit) : null,
    usedCount: Number(count) || 0,
    isActive: Boolean(coupon.isActive),
    startsAt: ((coupon.startsAt ?? coupon.valid_from) as Date | null) ?? null,
    expiresAt: ((coupon.expiresAt ?? coupon.valid_to) as Date | null) ?? null,
    createdAt: coupon.createdAt as Date,
  };
}

function buildCouponWhere(params: GetCouponsParams): Prisma.CouponWhereInput {
  const where: Prisma.CouponWhereInput = {};

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  if (params.search) {
    where.OR = [{ code: { contains: params.search } }];
  }

  return where;
}

export const couponRepository = {
  async findAll(params: GetCouponsParams = {}) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const where = buildCouponWhere(params);

    const [data, total] = await Promise.all([
      db.coupon.findMany({
        where,
        include: {
          _count: {
            select: { coupon_usage: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.coupon.count({ where }),
    ]);

    return {
      data: data.map((c) => toCouponListItem(c as unknown as Record<string, unknown>)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findById(id: number | bigint) {
    const coupon = await db.coupon.findUnique({
      where: { id: BigInt(id) },
      include: {
        _count: {
          select: { coupon_usage: true },
        },
      },
    });
    return coupon ? toCouponListItem(coupon as unknown as Record<string, unknown>) : null;
  },

  async findByCode(code: string) {
    const coupon = await db.coupon.findUnique({
      where: { code },
      include: {
        _count: {
          select: { coupon_usage: true },
        },
      },
    });
    return coupon ? toCouponListItem(coupon as unknown as Record<string, unknown>) : null;
  },

  async create(data: any) {
    const coupon = await db.coupon.create({
      data: {
        code: data.code,
        type: data.type,
        value: data.value,
        minOrderAmount: data.minOrderAmount ?? 0,
        max_discount_amount: data.maxDiscount ?? data.max_discount_amount,
        usageLimit: data.usageLimit,
        isActive: data.isActive ?? true,
        valid_from: data.startsAt ?? data.valid_from,
        valid_to: data.expiresAt ?? data.valid_to,
      },
    });
    return toCouponListItem(coupon as unknown as Record<string, unknown>);
  },

  async update(id: number | bigint, data: any) {
    const updateData: any = {};
    if (data.code !== undefined) updateData.code = data.code;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.minOrderAmount !== undefined) updateData.minOrderAmount = data.minOrderAmount;
    if (data.maxDiscount !== undefined || data.max_discount_amount !== undefined) {
      updateData.max_discount_amount = data.maxDiscount ?? data.max_discount_amount;
    }
    if (data.usageLimit !== undefined) updateData.usageLimit = data.usageLimit;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.startsAt !== undefined || data.valid_from !== undefined) {
      updateData.valid_from = data.startsAt ?? data.valid_from;
    }
    if (data.expiresAt !== undefined || data.valid_to !== undefined) {
      updateData.valid_to = data.expiresAt ?? data.valid_to;
    }

    const coupon = await db.coupon.update({ where: { id: BigInt(id) }, data: updateData });
    return toCouponListItem(coupon as unknown as Record<string, unknown>);
  },

  async delete(id: number | bigint) {
    return db.coupon.delete({ where: { id: BigInt(id) } });
  },

  /** Active coupon by code, with its category/product restrictions (internal ids). */
  async findActiveByCodeForValidation(code: string) {
    return db.coupon.findFirst({
      where: { code, isActive: true },
      include: {
        coupon_categories: { select: { category_id: true } },
        coupon_products: { select: { product_id: true } },
      },
    });
  },

  async countUsage(couponId: bigint) {
    return db.coupon_usage.count({ where: { coupon_id: couponId } });
  },

  async countUsageForUser(couponId: bigint, userId: bigint) {
    return db.coupon_usage.count({ where: { coupon_id: couponId, user_id: userId } });
  },

  /** Records a coupon's use against an order. Call inside the order-creation transaction. */
  async recordUsage(
    tx: Prisma.TransactionClient,
    params: { couponId: bigint; userId: bigint; orderId: bigint; discountAmount: number }
  ) {
    return tx.coupon_usage.create({
      data: {
        coupon_id: params.couponId,
        user_id: params.userId,
        order_id: params.orderId,
        discount_amount: params.discountAmount,
      },
    });
  },
};
