import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posService } from "@/features/pos/services/pos.service";
import { posVoidSchema, type PosVoidInput } from "@/features/pos/validations/pos.schema";

/**
 * Void a counter bill: stock back in, payment reversed, order cancelled.
 * The bill number is kept - a GST series may not have holes.
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const result = await posService.voidBill(context.body as PosVoidInput, {
        email: context.session?.user?.email,
      });
      return apiSuccess(result, `Bill ${result.invoiceNumber ?? result.orderNumber} voided`);
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VOID",
    bodySchema: posVoidSchema,
  }
);
