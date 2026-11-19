import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posService } from "@/features/pos/services/pos.service";

/**
 * Itemized purchase details for receipt re-printing, tax invoice review, or audit.
 */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const { uuid } = (context.params || {}) as { uuid: string };
      const detail = await posService.getPurchaseDetail(uuid);
      return apiSuccess(detail, "Purchase detail fetched");
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VIEW",
  }
);
