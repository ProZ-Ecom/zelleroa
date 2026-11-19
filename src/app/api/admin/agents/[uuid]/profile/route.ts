import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentProfileService } from "@/features/agents/services/agent-profile.service";

export const GET = createApiHandler(
  { GET: async (_request, context) => apiSuccess(await agentProfileService.getByRef(context.params?.uuid ?? "")) },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
