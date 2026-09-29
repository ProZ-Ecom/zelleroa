import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { resolveDeliveredAt } from "@/features/orders/repositories/order.repository";
import { findItemConflicts } from "../lib/guards";
import { getReturnWindow, type ReturnWindow } from "../lib/policy";
import { requestOrderItemSelect } from "../lib/includes";
import { summarizeOrderItem } from "../lib/summary";

export async function resolveCustomerId(sessionUserId: string): Promise<bigint> {
  const user = await userRepository.findById(sessionUserId);
  if (!user || !user.internalId) throw ApiError.unauthorized("User not found");
  return BigInt(user.internalId);
}

/**
 * Loads an order the customer owns. Someone else's order is reported as
 * "not found" so order ids can't be probed.
 */
export async function loadOwnedOrder(customerId: bigint, orderUuid: string) {
  const order = await db.order.findFirst({
    where: { uuid: orderUuid, is_active: true },
    include: {
      items: {
        where: { is_active: true },
        select: {
          ...requestOrderItemSelect.select,
          variant_unit_price: {
            select: { id: true, variant_id: true, attribute_value_id: true },
          },
        },
      },
      order_status_history: { where: { is_active: true } },
    },
  });
  if (!order || order.userId !== customerId) throw ApiError.notFound("Order not found");
  return order;
}

/** Shared gate for "may this order enter the return/replacement flow at all". */
export function assertOrderEligible(order: Parameters<typeof resolveDeliveredAt>[0]): ReturnWindow {
  if (order.order_status === "cancelled") {
    throw ApiError.badRequest("Cancelled orders cannot be returned or replaced.");
  }
  const window = getReturnWindow(order.order_status, resolveDeliveredAt(order));
  if (!window.eligible) {
    throw ApiError.badRequest(
      window.code === "WINDOW_EXPIRED"
        ? "The return period for this order has expired."
        : window.message
    );
  }
  return window;
}

export const eligibilityService = {
  async getForOrder(sessionUserId: string, orderUuid: string) {
    const customerId = await resolveCustomerId(sessionUserId);
    const order = await loadOwnedOrder(customerId, orderUuid);

    const window = getReturnWindow(order.order_status, resolveDeliveredAt(order));
    const cancelled = order.order_status === "cancelled";
    const orderEligible = window.eligible && !cancelled;

    const conflicts = orderEligible
      ? await findItemConflicts(db, order.items.map((i) => i.id))
      : [];

    // Sizes of the same colour variant that are in stock, per item.
    const variantIds = [...new Set(order.items.map((i) => i.variantId))];
    const sizeRows = orderEligible
      ? await db.variantUnitPrice.findMany({
          where: {
            variant_id: { in: variantIds },
            isActive: true,
            deleted_at: null,
            attribute_value_id: { not: null },
          },
          select: {
            id: true,
            uuid: true,
            variant_id: true,
            attribute_value: { select: { value: true } },
            inventories: { select: { quantity_available: true, quantity_reserved: true } },
          },
        })
      : [];

    const items = order.items.map((oi) => {
      const conflict = conflicts.find((c) => c.orderItemId === oi.id);
      const sizes = sizeRows
        .filter((r) => r.variant_id === oi.variantId)
        .map((r) => {
          const available = Math.max(
            0,
            (r.inventories?.quantity_available ?? 0) - (r.inventories?.quantity_reserved ?? 0)
          );
          return {
            id: r.uuid,
            label: r.attribute_value?.value ?? "",
            available,
            inStock: available >= oi.quantity,
            isCurrent: r.id === oi.variantUnitPriceId,
          };
        })
        .filter((r) => r.label && r.inStock);

      return {
        ...summarizeOrderItem(oi),
        quantity: oi.quantity,
        canRequest: orderEligible && !conflict,
        blockedReason: conflict
          ? `A ${conflict.kind} request is already ${conflict.status.replace(/_/g, " ")} for this item.`
          : null,
        replacementSizes: sizes,
      };
    });

    const anyFree = items.some((i) => i.canRequest);
    return {
      orderId: order.uuid || String(order.id),
      orderNumber: order.orderNumber,
      orderStatus: order.order_status,
      window: {
        eligible: window.eligible,
        code: window.code,
        message: cancelled ? "Cancelled orders cannot be returned or replaced." : window.message,
        deliveredAt: window.deliveredAt,
        deadline: window.deadline,
        daysLeft: window.daysLeft,
      },
      canReturn: orderEligible && anyFree,
      canReplace: orderEligible && items.some((i) => i.canRequest && i.replacementSizes.length > 0),
      items,
    };
  },
};
