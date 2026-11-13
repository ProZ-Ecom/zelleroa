import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posSessionService } from "@/features/pos/services/pos-session.service";
import {
  posShiftListSchema,
  type PosShiftListInput,
} from "@/features/pos/validations/pos.schema";

/** Shift history for the manager's report: who billed what, and whether cash matched. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const result = await posSessionService.list(context.query as PosShiftListInput);
      return apiSuccess(result.data, "Shifts fetched", 200, result.meta);
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_REPORT_VIEW",
    querySchema: posShiftListSchema,
  }
);
