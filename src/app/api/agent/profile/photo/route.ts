import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { agentProfileService } from "@/features/agents/services/agent-profile.service";
import { requireSessionAgent } from "@/features/agents/lib/api-helpers";

export const POST = createApiHandler(
  {
    POST: async (request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        throw ApiError.badRequest("Content-Type must be multipart/form-data");
      }
      return apiSuccess(await agentProfileService.savePhoto(agentId, formData), "Profile photo updated");
    },
  },
  { requireAuth: true, requiredRole: ["AGENT"], rateLimit: { limit: 20, windowMs: 60_000 } }
);
