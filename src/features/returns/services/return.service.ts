import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { resolveDeliveredAt } from "@/features/orders/repositories/order.repository";
import { returnRepository, type Actor } from "../repositories/return.repository";
import { getReturnWindow, RETURN_TRANSITIONS, type ReturnAction, type ReturnStatus } from "../lib/policy";
import { summarizeReturnRequest } from "../lib/summary";
import { videoService } from "./video.service";
import {
  assertOrderEligible,
  loadOwnedOrder,
  resolveCustomerId,
} from "./eligibility.service";
import type {
  AdminReturnListInput,
  CustomerReturnListInput,
  RequestActionInput,
  SubmitReturnInput,
} from "../validations/return.schema";

function formatRequest(req: any) {
  const window = getReturnWindow("delivered", resolveDeliveredAt(req.orders));
  return {
    ...summarizeReturnRequest(req),
    orderId: req.orders.uuid || String(req.orders.id),
    orderNumber: req.orders.orderNumber,
    orderStatus: req.orders.order_status,
    deliveredAt: resolveDeliveredAt(req.orders),
    returnDeadline: window.deadline,
    orderTotal: Number(req.orders.totalAmount),
    customer: {
      id: req.users_return_requests_user_idTousers.uuid || String(req.users_return_requests_user_idTousers.id),
      name: req.users_return_requests_user_idTousers.name,
      email: req.users_return_requests_user_idTousers.email,
      phone: req.users_return_requests_user_idTousers.phone,
    },
  };
}

function meta(result: { total: number; page: number; limit: number }) {
  return {
    page: result.page,
    limit: result.limit,
    pageSize: result.limit,
    total: result.total,
    totalPages: Math.ceil(result.total / result.limit) || 1,
  };
}

async function resolveActor(sessionUserId: string): Promise<Actor> {
  const user = await userRepository.findById(sessionUserId);
  if (!user || !user.internalId) {
    throw ApiError.unauthorized("Session expired. Please log in again.");
  }
  const role = String(user.role?.name ?? "ADMIN").toUpperCase();
  return { id: BigInt(user.internalId), type: role === "STAFF" ? "STAFF" : "ADMIN" };
}

export const returnService = {
  async createCustomerReturnRequest(
    sessionUserId: string,
    orderUuid: string,
    input: SubmitReturnInput
  ) {
    const customerId = await resolveCustomerId(sessionUserId);
    const order = await loadOwnedOrder(customerId, orderUuid);

    // Deadline / status rules live here, not in the UI.
    assertOrderEligible(order);

    const byId = new Map(order.items.map((i) => [i.uuid || String(i.id), i]));
    const lines = input.items.map((line) => {
      const item = byId.get(line.orderItemId);
      if (!item) {
        throw ApiError.badRequest("One of the selected items does not belong to this order");
      }
      if (line.quantity > item.quantity) {
        throw ApiError.badRequest(
          `Return quantity (${line.quantity}) exceeds purchased quantity (${item.quantity}) for '${item.product_name_snapshot}'`
        );
      }
      const perUnit = Number(item.total_price) / item.quantity;
      return {
        orderItemId: item.id,
        quantity: line.quantity,
        refundAmount: Math.round(perUnit * line.quantity * 100) / 100,
        label: item.product_name_snapshot,
      };
    });

    const videoUrl = await videoService.assertOwnedVideo(customerId, input.unboxingVideoUrl);

    const created = await returnRepository.create({
      orderId: order.id,
      userId: customerId,
      reason: input.reason,
      description: input.description,
      unboxingVideoUrl: videoUrl,
      items: lines,
    });
    return formatRequest(created);
  },

  async getCustomerReturnRequests(sessionUserId: string, params: CustomerReturnListInput) {
    const customerId = await resolveCustomerId(sessionUserId);
    const result = await returnRepository.listForCustomer(customerId, params);
    return { data: result.requests.map(formatRequest), meta: meta(result) };
  },

  async getCustomerReturnRequestByUuid(sessionUserId: string, uuid: string) {
    const customerId = await resolveCustomerId(sessionUserId);
    const req = await returnRepository.findByUuid(uuid, customerId);
    if (!req) throw ApiError.notFound("Return request not found");
    return formatRequest(req);
  },

  async getAdminReturnRequests(params: AdminReturnListInput) {
    const result = await returnRepository.listForAdmin(params);
    return { data: result.requests.map(formatRequest), meta: meta(result) };
  },

  async getAdminReturnRequestByUuid(uuid: string) {
    const req = await returnRepository.findByUuid(uuid);
    if (!req) throw ApiError.notFound("Return request not found");
    return formatRequest(req);
  },

  async performAction(
    adminSessionUserId: string,
    uuid: string,
    action: ReturnAction,
    input: RequestActionInput = {}
  ) {
    const rule = RETURN_TRANSITIONS[action];
    if (!rule) throw ApiError.notFound("Unknown action");

    const actor = await resolveActor(adminSessionUserId);
    const req = await returnRepository.findByUuid(uuid);
    if (!req) throw ApiError.notFound("Return request not found");

    const current = req.status as ReturnStatus;
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

    const updated = await returnRepository.transition({
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
