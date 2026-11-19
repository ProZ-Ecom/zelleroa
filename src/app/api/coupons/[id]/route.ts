import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { couponService } from "@/features/coupons/services/coupon.service";
import { updateCouponSchema } from "@/features/coupons/validations/coupon.schema";

export const GET = createApiHandler({
  GET: async (_request, context) => {
    const id = context.params?.id;
    if (!id) return apiError("Coupon ID is required", 400);
    const coupon = await couponService.getCoupon(parseInt(id));
    return apiSuccess(coupon, "Coupon fetched successfully");
  },
}, { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] });

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const id = context.params?.id;
      if (!id) return apiError("Coupon ID is required", 400);
      const body = context.body as ReturnType<typeof updateCouponSchema.parse>;
      const coupon = await couponService.updateCoupon(parseInt(id), {
        ...body,
        startsAt: body.startsAt ? new Date(body.startsAt as string) : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt as string) : undefined,
      });
      return apiSuccess(coupon, "Coupon updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateCouponSchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const id = context.params?.id;
      if (!id) return apiError("Coupon ID is required", 400);
      await couponService.deleteCoupon(parseInt(id));
      return apiSuccess(null, "Coupon deleted successfully");
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);
