import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { commissionService } from "@/features/agents/services/commission.service";
import { resolveActor } from "@/features/agents/lib/api-helpers";

/** Approves every pending commission whose return period has ended. */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const actor = await resolveActor(context.session);
      const approved = await commissionService.approveEligible({ actor });
      return apiSuccess({ approved }, `${approved} commission(s) approved`);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"] }
);
