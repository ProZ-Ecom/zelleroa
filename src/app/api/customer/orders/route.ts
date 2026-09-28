import { createApiHandler } from "@/lib/api/api-handler";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { orderService } from "@/features/orders/services/order.service";
import {
  customerCreateOrderSchema,
  type CustomerCreateOrderInput,
} from "@/features/orders/validations/order.schema";

/**
 * POST /api/customer/orders
 * Place a new order from the customer's active cart.
 *
 * Previously this handler had a dual-purpose branch:
 *   if (body.shippingAddressId) -> create order
 *   else                        -> list orders
 *
 * This was broken because createApiHandler only populates context.body when a
 * bodySchema is provided in options. Without it, context.body is always
 * undefined, so body.shippingAddressId was always falsy and every POST fell
 * through to the list branch — the order was never created.
 *
 * Fix: add bodySchema so context.body is populated and validated before the
 * handler runs.
 */
export const POST = createApiHandler(
  {
    POST: async (request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const body = context.body as CustomerCreateOrderInput;
      // `request` carries the referral cookie so a first-time agent link can be attributed.
      const order = await orderService.createCustomerOrder(sessionUserId, body, request);
      return apiCreated(order, "Order placed successfully");
    },
  },
  {
    requireAuth: true,
    bodySchema: customerCreateOrderSchema,
  }
);

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUserId = context.session?.user?.id;
      if (!sessionUserId) {
        throw ApiError.unauthorized("Authentication required");
      }

      const query = (context.query || {}) as Record<string, any>;
      const result = await orderService.getCustomerOrders(sessionUserId, query);

      return apiSuccess(
        result.data,
        "Orders fetched successfully",
        200,
        result.meta
      );
    },
  },
  {
    requireAuth: true,
  }
);

