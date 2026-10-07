import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { commissionService } from "@/features/agents/services/commission.service";
import { resolveActor } from "@/features/agents/lib/api-helpers";

const approveSchema = z.object({
  /** Commission ids to approve; omit to approve everything awaiting approval. */
  ids: z.array(z.string().trim().min(1)).max(500).optional(),
});

/** Admin only: approves commissions whose return period is over (`pending_approval` -> `approved`). */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const actor = await resolveActor(context.session);
      const body = context.body as z.infer<typeof approveSchema>;
      const approved = await commissionService.approve({ ids: body.ids, actor });
      return apiSuccess({ approved }, `${approved} commission(s) approved`);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: approveSchema }
);
