import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated, apiFromError } from "@/lib/api/api-response";
import { orderService } from "@/features/orders/services/order.service";
import {
  getOrdersQuerySchema,
  placeOrderSchema,
} from "@/features/orders/validations/order.schema";
import type { GetOrdersQueryInput, PlaceOrderSchemaInput } from "@/features/orders/validations/order.schema";

function getUserId(context: { session?: { user?: unknown } | null }) {
  const id = parseInt((context.session?.user as { id?: string })?.id ?? "0");
  if (!id) {
    throw new Error("Unauthorized");
  }
  return id;
}

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      try {
        const userId = getUserId(context);
        const query = context.query as GetOrdersQueryInput;
        const result = await orderService.getOrders(userId, {
          page: query.page,
          limit: query.limit,
          search: query.search,
          status: query.status,
        });
        return apiSuccess(result.data, "Orders fetched successfully", 200, result.meta);
      } catch (error) {
        return apiFromError(error);
      }
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"], querySchema: getOrdersQuerySchema }
);

export const POST = createApiHandler(
  {
    POST: async (request, context) => {
      try {
        const userId = getUserId(context);
        const body = context.body as PlaceOrderSchemaInput;
        const order = await orderService.placeOrder(userId, body, request);
        return apiCreated(order, "Order placed successfully");
      } catch (error) {
        return apiFromError(error);
      }
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"], bodySchema: placeOrderSchema }
);
