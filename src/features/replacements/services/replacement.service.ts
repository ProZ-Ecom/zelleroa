import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { resolveDeliveredAt } from "@/features/orders/repositories/order.repository";
import {
  getReturnWindow,
  REPLACEMENT_TRANSITIONS,
  type ReplacementAction,
  type ReplacementStatus,
} from "@/features/returns/lib/policy";
import { summarizeReplacementRequest } from "@/features/returns/lib/summary";
import { videoService } from "@/features/returns/services/video.service";
import {
  assertOrderEligible,
  loadOwnedOrder,
  resolveCustomerId,
} from "@/features/returns/services/eligibility.service";
import type { Actor } from "@/features/returns/repositories/return.repository";
import type { RequestActionInput } from "@/features/returns/validations/return.schema";
import { replacementRepository } from "../repositories/replacement.repository";
import type { ReplacementListInput, SubmitReplacementInput } from "../validations/replacement.schema";

function formatRequest(req: any) {
  const delivered = resolveDeliveredAt(req.orders);
  return {
    ...summarizeReplacementRequest(req),
    orderId: req.orders.uuid || String(req.orders.id),
    orderNumber: req.orders.orderNumber,
    orderStatus: req.orders.order_status,
    deliveredAt: delivered,
    returnDeadline: getReturnWindow("delivered", delivered).deadline,
    shippedAt: req.shipped_at ?? null,
    deliveredReplacementAt: req.delivered_at ?? null,
    customer: {
      id: req.user.uuid || String(req.user.id),
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
    },
  };
}

function meta(r: { total: number; page: number; limit: number }) {
  return { page: r.page, limit: r.limit, pageSize: r.limit, total: r.total, totalPages: Math.ceil(r.total / r.limit) || 1 };
}

async function resolveActor(sessionUserId: string): Promise<Actor> {
  const user = await userRepository.findById(sessionUserId);
  if (!user || !user.internalId) throw ApiError.unauthorized("Session expired. Please log in again.");
  const role = String(user.role?.name ?? "ADMIN").toUpperCase();
  return { id: BigInt(user.internalId), type: role === "STAFF" ? "STAFF" : "ADMIN" };
}

export const replacementService = {
  async createCustomerReplacementRequest(
    sessionUserId: string,
    orderUuid: string,
    input: SubmitReplacementInput
  ) {
    const customerId = await resolveCustomerId(sessionUserId);
    const order = await loadOwnedOrder(customerId, orderUuid);
    assertOrderEligible(order);

    const byId = new Map(order.items.map((i) => [i.uuid || String(i.id), i]));

    const lines = [];
    for (const line of input.items) {
      const item = byId.get(line.orderItemId);
      if (!item) throw ApiError.badRequest("One of the selected items does not belong to this order");
      if (line.quantity > item.quantity) {
        throw ApiError.badRequest(
          `Replacement quantity (${line.quantity}) exceeds purchased quantity (${item.quantity}) for '${item.product_name_snapshot}'`
        );
      }

      // Only a size of the very same colour variant can be swapped in.
      const target = line.requestedVariantUnitPriceId
        ? await db.variantUnitPrice.findFirst({
            where: { uuid: line.requestedVariantUnitPriceId, variant_id: item.variantId },
            select: {
              id: true,
              variant_id: true,
              isActive: true,
              deleted_at: true,
              attribute_value_id: true,
              inventories: { select: { quantity_available: true, quantity_reserved: true } },
            },
          })
        : item.variantUnitPriceId
          ? await db.variantUnitPrice.findUnique({
              where: { id: item.variantUnitPriceId },
              select: {
                id: true,
                variant_id: true,
                isActive: true,
                deleted_at: true,
                attribute_value_id: true,
                inventories: { select: { quantity_available: true, quantity_reserved: true } },
              },
            })
          : null;

      if (!target || !target.isActive || target.deleted_at) {
        throw ApiError.badRequest(`The selected replacement size for '${item.product_name_snapshot}' is not available`);
      }
      const available =
        (target.inventories?.quantity_available ?? 0) - (target.inventories?.quantity_reserved ?? 0);
      if (available < line.quantity) {
        throw ApiError.badRequest(`The selected replacement size for '${item.product_name_snapshot}' is out of stock`);
      }

      lines.push({
        orderItemId: item.id,
        quantity: line.quantity,
        requestedVariantId: target.variant_id,
        requestedVariantUnitPriceId: target.id,
        label: item.product_name_snapshot,
      });
    }

    const videoUrl = await videoService.assertOwnedVideo(customerId, input.unboxingVideoUrl);
    const created = await replacementRepository.create({
      orderId: order.id,
      userId: customerId,
      reason: input.reason,
      description: input.description,
      unboxingVideoUrl: videoUrl,
      items: lines,
    });
    return formatRequest(created);
  },

  async getCustomerReplacements(sessionUserId: string, params: ReplacementListInput) {
    const customerId = await resolveCustomerId(sessionUserId);
    const result = await replacementRepository.list(params, customerId);
    return { data: result.requests.map(formatRequest), meta: meta(result) };
  },

  async getCustomerReplacementByUuid(sessionUserId: string, uuid: string) {
    const customerId = await resolveCustomerId(sessionUserId);
    const req = await replacementRepository.findByUuid(uuid, customerId);
    if (!req) throw ApiError.notFound("Replacement request not found");
    return formatRequest(req);
  },

  async getAdminReplacements(params: ReplacementListInput) {
    const result = await replacementRepository.list(params);
    return { data: result.requests.map(formatRequest), meta: meta(result) };
  },

  async getAdminReplacementByUuid(uuid: string) {
    const req = await replacementRepository.findByUuid(uuid);
    if (!req) throw ApiError.notFound("Replacement request not found");
    return formatRequest(req);
  },

  async performAction(
    adminSessionUserId: string,
    uuid: string,
    action: ReplacementAction,
    input: RequestActionInput = {}
  ) {
    const rule = REPLACEMENT_TRANSITIONS[action];
    if (!rule) throw ApiError.notFound("Unknown action");

    const actor = await resolveActor(adminSessionUserId);
    const req = await replacementRepository.findByUuid(uuid);
    if (!req) throw ApiError.notFound("Replacement request not found");

    const current = req.status as ReplacementStatus;
    if (!rule.from.includes(current)) {
      throw ApiError.badRequest(
        `Cannot ${rule.label.toLowerCase()} a request that is '${current.replace(/_/g, " ")}'.`
      );
    }

    const rejectionReason = (input.rejectionReason ?? input.comment ?? "").trim();
    if (action === "reject" && rejectionReason.length < 3) {
      throw ApiError.badRequest("A rejection reason is required");
    }

    let pickupAt: Date | undefined;
    if (action === "pickup" && input.pickupDate) {
      pickupAt = new Date(input.pickupDate);
      if (Number.isNaN(pickupAt.getTime())) throw ApiError.badRequest("Invalid pickup date");
    }

    const updated = await replacementRepository.transition({
      request: { id: req.id, status: current, orderId: req.order_id },
      action,
      to: rule.to,
      actor,
      comment: input.comment,
      rejectionReason: action === "reject" ? rejectionReason : undefined,
      pickupAt,
      note: input.note,
    });
    return formatRequest(updated);
  },
};
