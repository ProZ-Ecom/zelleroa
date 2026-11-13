import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posService } from "@/features/pos/services/pos.service";
import {
  posPurchasesQuerySchema,
  type PosPurchasesQueryInput,
} from "@/features/pos/validations/pos.schema";

/**
 * Purchases list for the POS counter module:
 * Searchable, filterable by date/tender/status, paginated, and summarized.
 */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const result = await posService.getPurchases(context.query as PosPurchasesQueryInput);
      return apiSuccess(
        { items: result.data, summary: result.summary },
        "Purchases fetched",
        200,
        result.meta
      );
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VIEW",
    querySchema: posPurchasesQuerySchema,
  }
);
