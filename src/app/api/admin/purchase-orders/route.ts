import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { purchaseService } from "@/features/purchases/services/purchase.service";
import {
  purchaseOrderSchema,
  purchaseQuerySchema,
  type PurchaseOrderInput,
} from "@/features/purchases/validations/purchase.schema";
import type { GetPurchasesParams } from "@/features/purchases/types";

const roles = ["ADMIN", "STAFF"];

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = (context.query ?? {}) as GetPurchasesParams;
      const result = await purchaseService.list({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
        search: query.search,
        status: query.status,
        vendorId: query.vendorId,
      });
      return apiSuccess(result.data, "Purchase orders fetched successfully", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: roles, querySchema: purchaseQuerySchema }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const po = await purchaseService.create(
        context.body as PurchaseOrderInput,
        context.session?.user?.email
      );
      return apiCreated(po, "Purchase order created successfully");
    },
  },
  { method: "POST", requireAuth: true, requiredRole: roles, bodySchema: purchaseOrderSchema }
);
