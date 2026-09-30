import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { agentService } from "@/features/agents/services/agent.service";
import { paymentDetailsSchema, type PaymentDetailsInput } from "@/features/agents/validations/agent.schema";
import { requireSessionAgent } from "@/features/agents/lib/api-helpers";

const handler = createApiHandler(
  {
    GET: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      return apiSuccess(await agentService.getProfile(agentId));
    },
    PUT: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      const profile = await agentService.savePaymentDetails(agentId, context.body as PaymentDetailsInput);
      return apiSuccess(profile, "Payment details saved");
    },
  },
  { requireAuth: true, requiredRole: ["AGENT"], bodySchema: paymentDetailsSchema }
);

export const GET = handler;
export const PUT = handler;
