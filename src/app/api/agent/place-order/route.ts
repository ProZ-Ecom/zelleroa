import { createApiHandler } from "@/lib/api/api-handler";
import { apiCreated } from "@/lib/api/api-response";
import { requireSessionAgent } from "@/features/agents/lib/api-helpers";
import { agentOrderService } from "@/features/agents/services/agent-order.service";
import { agentPlaceOrderSchema, type AgentPlaceOrderInput } from "@/features/agents/validations/agent-order.schema";

/** A Sales Partner places an order for one of their assigned customers, or a walk-in buyer. */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      const order = await agentOrderService.placeOrder(agentId, context.body as AgentPlaceOrderInput);
      return apiCreated(order, "Order placed");
    },
  },
  { requireAuth: true, requiredRole: ["AGENT"], bodySchema: agentPlaceOrderSchema, rateLimit: { limit: 20, windowMs: 60_000 } }
);
