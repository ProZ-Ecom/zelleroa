import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posExchangeService } from "@/features/pos/services/pos-exchange.service";
import {
  posExchangeLookupSchema,
  type PosExchangeLookupInput,
} from "@/features/pos/validations/pos-exchange.schema";

/**
 * Look up bills eligible for exchange using invoice number, order number, or customer mobile.
 */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const bills = await posExchangeService.lookupBills(
        context.query as PosExchangeLookupInput,
        {
          email: context.session?.user?.email,
          role: context.session?.user?.role,
        }
      );
      return apiSuccess(
        bills,
        bills.length > 0 ? `${bills.length} bill(s) found` : "No matching eligible bills found"
      );
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VIEW",
    querySchema: posExchangeLookupSchema,
  }
);
