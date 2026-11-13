import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posService } from "@/features/pos/services/pos.service";
import { posBillSchema, type PosBillInput } from "@/features/pos/validations/pos.schema";

/** Today's bills from the caller's open shift, for the side list on the screen. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const bills = await posService.recentBills({ email: context.session?.user?.email });
      return apiSuccess(bills, "Recent bills fetched");
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VIEW",
  }
);

/**
 * Ring up a counter sale.
 *
 * The response is the receipt: the screen prints straight from it rather than
 * fetching the order back, so the next customer is not kept waiting.
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const bill = await posService.createBill(context.body as PosBillInput, {
        email: context.session?.user?.email,
        role: context.session?.user?.role,
      });
      return apiSuccess(bill, `Bill ${bill.invoiceNumber} created`);
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_BILL",
    bodySchema: posBillSchema,
    rateLimit: { limit: 300, windowMs: 60_000 },
  }
);
