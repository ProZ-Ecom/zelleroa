import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { pricingService } from "@/features/inventory/services/pricing.service";
import {
  applyPricingSchema,
  pricingListQuerySchema,
  type ApplyPricingInput,
  type PricingListQuery,
} from "@/features/inventory/validations/pricing.schema";

const roles = ["ADMIN", "STAFF"];

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const result = await pricingService.list(context.query as PricingListQuery);
      return apiSuccess(result.data, "Pricing fetched", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: roles, querySchema: pricingListQuerySchema }
);

/** Writes new selling prices, one by one or across a selection. */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const summary = await pricingService.apply(
        context.body as ApplyPricingInput,
        context.session?.user?.email
      );
      return apiSuccess(
        summary,
        summary.updated === 1 ? "1 price updated" : `${summary.updated} prices updated`
      );
    },
  },
  { method: "POST", requireAuth: true, requiredRole: roles, bodySchema: applyPricingSchema }
);
