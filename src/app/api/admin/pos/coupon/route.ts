import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posService } from "@/features/pos/services/pos.service";
import {
  posCouponValidateSchema,
  type PosCouponValidateInput,
} from "@/features/pos/validations/pos.schema";

export const GET = createApiHandler(
  {
    GET: async () => {
      const coupons = await posService.getActiveCoupons();
      return apiSuccess(coupons, "Active coupons fetched");
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VIEW",
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const result = await posService.validateCoupon(
        context.body as PosCouponValidateInput,
        { email: context.session?.user?.email, role: context.session?.user?.role }
      );
      return apiSuccess(result, "Coupon applied successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VIEW",
    bodySchema: posCouponValidateSchema,
  }
);

