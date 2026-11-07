import { createApiHandler } from "@/lib/api/api-handler";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { purchaseReturnService } from "@/features/purchases/services/purchase-return.service";
import {
  createPurchaseReturnSchema,
  purchaseReturnsQuerySchema,
  type CreatePurchaseReturnInput,
} from "@/features/purchases/validations/purchase-return.schema";
import type { GetPurchaseReturnsParams } from "@/features/purchases/types";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const { data, meta } = await purchaseReturnService.list(
        (context.query ?? {}) as GetPurchaseReturnsParams
      );
      return apiSuccess(data, "Purchase returns fetched successfully", 200, meta);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"], querySchema: purchaseReturnsQuerySchema }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const created = await purchaseReturnService.create(
        context.body as CreatePurchaseReturnInput,
        context.session?.user?.email
      );
      return apiCreated(created, "Purchase return drafted");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: createPurchaseReturnSchema,
  }
);
