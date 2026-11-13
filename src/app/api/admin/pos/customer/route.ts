import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posService } from "@/features/pos/services/pos.service";
import {
  posCustomerLookupSchema,
  type PosCustomerLookupInput,
} from "@/features/pos/validations/pos.schema";

/** Match a walk-in's phone to an existing account, so the bill lands in their history. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const result = await posService.lookupCustomer(context.query as PosCustomerLookupInput);
      return apiSuccess(result, result.found ? "Customer found" : "No account for this number");
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VIEW",
    querySchema: posCustomerLookupSchema,
  }
);
