import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posService } from "@/features/pos/services/pos.service";
import {
  posProductSearchSchema,
  type PosProductSearchInput,
} from "@/features/pos/validations/pos.schema";

/** SKU lookup for the billing screen: `?sku=` for an exact hit, `?search=` for a list. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const options = await posService.searchProducts(context.query as PosProductSearchInput);
      return apiSuccess(options, "Products fetched");
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VIEW",
    querySchema: posProductSearchSchema,
    // A cashier types a SKU per item all day; the default 60/min is too tight.
    rateLimit: { limit: 600, windowMs: 60_000 },
  }
);
