import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { couponService } from "@/features/coupons/services/coupon.service";
import { getCouponsQuerySchema, createCouponSchema } from "@/features/coupons/validations/coupon.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as ReturnType<typeof getCouponsQuerySchema.parse>;
      const result = await couponService.getCoupons({
        page: query.page,
        limit: query.limit,
        search: query.search,
        isActive: query.isActive,
      });
      return apiSuccess(result.data, "Coupons fetched successfully", 200, result.meta);
    },
  },
  { querySchema: getCouponsQuerySchema, requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as ReturnType<typeof createCouponSchema.parse>;
      const coupon = await couponService.createCoupon({
        ...body,
        startsAt: body.startsAt ? new Date(body.startsAt as string) : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt as string) : undefined,
      });
      return apiCreated(coupon, "Coupon created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: createCouponSchema,
  }
);
