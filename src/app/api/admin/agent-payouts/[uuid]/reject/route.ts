import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { payoutService } from "@/features/agents/services/payout.service";
import { rejectPayoutSchema } from "@/features/agents/validations/agent.schema";
import { resolveActor } from "@/features/agents/lib/api-helpers";
import type { z } from "zod";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const actor = await resolveActor(context.session);
      const { reason } = context.body as z.infer<typeof rejectPayoutSchema>;
      const payout = await payoutService.reject(context.params?.uuid ?? "", reason, actor);
      return apiSuccess(payout, "Payout rejected. The commissions are available for a new request.");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: rejectPayoutSchema }
);
