import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentService } from "@/features/agents/services/agent.service";

export const GET = createApiHandler(
  { GET: async () => apiSuccess(await agentService.agentOptions()) },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
