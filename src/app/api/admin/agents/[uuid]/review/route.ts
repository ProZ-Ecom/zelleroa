import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentProfileService } from "@/features/agents/services/agent-profile.service";
import { reviewSchema, type ReviewInput } from "@/features/agents/validations/agent-profile.schema";
import { resolveActor } from "@/features/agents/lib/api-helpers";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const actor = await resolveActor(context.session);
      const profile = await agentProfileService.review(context.params?.uuid ?? "", context.body as ReviewInput, actor);
      return apiSuccess(profile, "Review saved");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: reviewSchema }
);
