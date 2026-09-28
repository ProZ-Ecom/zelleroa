import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { payoutService } from "@/features/agents/services/payout.service";
import { resolveActor } from "@/features/agents/lib/api-helpers";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const actor = await resolveActor(context.session);
      const payout = await payoutService.approve(context.params?.uuid ?? "", actor);
      return apiSuccess(payout, "Payout approved");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"] }
);
