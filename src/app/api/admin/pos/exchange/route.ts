import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posExchangeService } from "@/features/pos/services/pos-exchange.service";
import {
  posExchangeInputSchema,
  type PosExchangeInput,
} from "@/features/pos/validations/pos-exchange.schema";

/**
 * Process a counter return / exchange.
 *
 * Validates remaining item eligibility, ensures full value utilization for lower-value returns,
 * adjusts inventory (RETURN inward, optional DAMAGE write-off, and SALE/REPLACEMENT outward),
 * attributes payments to the active shift, and returns the thermal receipt DTO.
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const receipt = await posExchangeService.processExchange(
        context.body as PosExchangeInput,
        {
          email: context.session?.user?.email,
          role: context.session?.user?.role,
        }
      );
      return apiSuccess(receipt, `Exchange ${receipt.exchangeNumber} completed successfully`);
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VIEW",
    bodySchema: posExchangeInputSchema,
    rateLimit: { limit: 120, windowMs: 60_000 },
  }
);
