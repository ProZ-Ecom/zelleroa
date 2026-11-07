import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { payoutService } from "@/features/agents/services/payout.service";
import { markPaidSchema } from "@/features/agents/validations/agent.schema";
import { resolveActor } from "@/features/agents/lib/api-helpers";
import type { z } from "zod";

/**
 * Approves a requested payout and records the transfer in one call, so the
 * admin never leaves a payout sitting in `approved` with no reference. Both
 * transitions run in a single transaction and both are audited.
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const actor = await resolveActor(context.session);
      const body = context.body as z.infer<typeof markPaidSchema>;
      const payout = await payoutService.approveAndPay(context.params?.uuid ?? "", body, actor);
      return apiSuccess(payout, "Payout approved and marked as paid");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: markPaidSchema }
);
