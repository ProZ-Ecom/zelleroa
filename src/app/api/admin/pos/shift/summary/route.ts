import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { posSessionService } from "@/features/pos/services/pos-session.service";
import { z } from "zod";

const querySchema = z.object({ sessionUuid: z.string().trim().min(1) });

/** Running totals for one shift: what the close screen shows before counting. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const { sessionUuid } = context.query as z.infer<typeof querySchema>;
      const summary = await posSessionService.getSummary(sessionUuid);
      return apiSuccess(summary, "Shift summary fetched");
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_SHIFT",
    querySchema,
  }
);
