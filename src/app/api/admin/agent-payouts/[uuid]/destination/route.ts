import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { payoutService } from "@/features/agents/services/payout.service";
import { resolveActor } from "@/features/agents/lib/api-helpers";

/** Reveals the full payment destination (audited) so an admin can actually send the money. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const actor = await resolveActor(context.session);
      return apiSuccess(await payoutService.revealDestination(context.params?.uuid ?? "", actor));
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], rateLimit: { limit: 30, windowMs: 60_000 } }
);
