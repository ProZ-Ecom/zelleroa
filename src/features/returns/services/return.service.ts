import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { encryptField } from "@/lib/security/field-crypto";
import { userRepository } from "@/features/users/repositories/user.repository";
import { resolveDeliveredAt, formatOrderAddress } from "@/features/orders/repositories/order.repository";
import { razorpayService } from "@/features/payment/services/razorpay.service";
import { returnRepository, type Actor } from "../repositories/return.repository";
import {
  getReturnWindow,
  getShipWindow,
  RETURN_CUSTOMER_ACTIONS,
  RETURN_TRANSITIONS,
  SHIPPING_SLIP_MANDATORY_NOTICE,
  type ReturnAction,
  type ReturnStatus,
} from "../lib/policy";
import { summarizeReturnRequest } from "../lib/summary";
import { slipService } from "./slip.service";
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
  const shippingRaw = (req.orders.address || []).find((a: any) => a.type === "shipping");
  const billingRaw = (req.orders.address || []).find((a: any) => a.type === "billing");
  const shippingAddress = formatOrderAddress(shippingRaw || billingRaw || null);
  const originalShipment = (req.orders.shipments || []).find((s: any) => s.tracking_number);
  const originalCourier = originalShipment
    ? {
        carrier: originalShipment.delivery_partners?.name || null,
        trackingNumber: originalShipment.tracking_number,
      }
    : null;
  const ship = getShipWindow(req.approved_at);
  return {
    ...summarizeReturnRequest(req),
    /** Ship-back deadline and how much of it is left, for the approved state. */
    shipDeadline: req.ship_deadline_at ?? ship.deadline,
    shipDaysLeft: ship.daysLeft,
    /** True when the request sat in `approved` past the deadline. */
    shipWindowExpired: ship.expired && req.status === "approved",
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
    shippingAddress,
    originalCourier,
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

export interface GatewayRefundResult {
  /** False when the order has no online payment to refund (COD). */
  attempted: boolean;
  ok: boolean;
  message: string;
  transactionRef?: string;
}

/**
 * Prepaid returns are refunded at the gateway the moment the refund is
 * initiated; COD ones stay manual, since the customer's bank / UPI details are
 * on the request. Deliberately runs after the status transition has committed:
 * a gateway outage must not roll the request back to `received`. On failure the
 * refund row stays `initiated`, the timeline says what went wrong, and the
 * admin can still settle it by hand and mark the request refunded.
 */
async function settleRefundAtGateway(
  requestId: bigint,
  orderId: bigint,
  actor: Actor
): Promise<GatewayRefundResult | undefined> {
  const pending = await returnRepository.findPendingRefund(requestId);
  if (!pending) return undefined;

  const payment = await razorpayService.findCapturedPayment(orderId);
  if (!payment?.gateway_payment_id) {
    return {
      attempted: false,
      ok: false,
      message: "No online payment on this order - refund the customer manually.",
    };
  }

  const amount = Number(pending.amount);
  try {
    const refund = await razorpayService.createGatewayRefund({
      gatewayPaymentId: payment.gateway_payment_id,
      amount,
      notes: {
        orderId: String(orderId),
        returnRequestId: String(requestId),
        reason: "Return refund",
      },
    });
    const transactionRef = String(refund.id);
    await returnRepository.recordGatewayRefundOutcome({
      requestId,
      refundId: pending.id,
      paymentId: payment.id,
      actor,
      outcome: { ok: true, transactionRef, amount, gatewayResponse: refund },
    });
    return {
      attempted: true,
      ok: true,
      transactionRef,
      message: `Refund of ₹${amount.toFixed(2)} sent to Razorpay (${transactionRef}).`,
    };
  } catch (err: unknown) {
    const reason =
      (err as { error?: { description?: string } })?.error?.description ??
      (err instanceof Error ? err.message : "Unknown gateway error");
    console.error(
      `[Returns] CRITICAL: automatic refund failed for return request ${requestId} (order ${orderId}):`,
      err
    );
    await returnRepository.recordGatewayRefundOutcome({
      requestId,
      refundId: pending.id,
      paymentId: payment.id,
      actor,
      outcome: { ok: false, message: reason },
    });
    return {
      attempted: true,
      ok: false,
      message: `Automatic refund failed: ${reason}. Refund the customer manually, then mark the request refunded.`,
    };
  }
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

    // Determine if the order was paid via Cash on Delivery
    const payment = await db.payment.findFirst({
      where: { orderId: order.id },
      include: { payment_methods: true },
      orderBy: { createdAt: "desc" },
    });
    const paymentMethodCode = payment?.payment_methods?.code?.toUpperCase();
    const isCod = !payment || paymentMethodCode === "COD" || payment.gateway === "COD";

    let codRefundDetails: {
      method: "bank_transfer" | "upi";
      accountHolderName?: string;
      bankName?: string;
      accountNumberEnc?: string;
      accountLast4?: string;
      ifscCode?: string;
      upiId?: string;
    } | undefined = undefined;

    if (input.codRefundDetails) {
      if (input.codRefundDetails.method === "bank_transfer" && input.codRefundDetails.accountNumber) {
        const rawAcc = input.codRefundDetails.accountNumber.trim();
        codRefundDetails = {
          method: "bank_transfer",
          accountHolderName: input.codRefundDetails.accountHolderName?.trim(),
          bankName: input.codRefundDetails.bankName?.trim() || undefined,
          accountNumberEnc: encryptField(rawAcc),
          accountLast4: rawAcc.slice(-4),
          ifscCode: input.codRefundDetails.ifscCode?.trim().toUpperCase(),
        };
      } else if (input.codRefundDetails.method === "upi") {
        codRefundDetails = {
          method: "upi",
          upiId: input.codRefundDetails.upiId?.trim(),
        };
      }
    } else if (isCod && !input.codRefundDetails) {
      throw ApiError.badRequest("Bank or UPI details are required for refunding a Cash on Delivery order.");
    }

    const created = await returnRepository.create({
      orderId: order.id,
      userId: customerId,
      reason: input.reason,
      description: input.description,
      unboxingVideoUrl: videoUrl,
      items: lines,
      codRefundDetails,
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

  /** Admin / staff workflow step. */
  async performAction(
    adminSessionUserId: string,
    uuid: string,
    action: ReturnAction,
    input: RequestActionInput = {}
  ) {
    const actor = await resolveActor(adminSessionUserId);
    const req = await returnRepository.findByUuid(uuid);
    if (!req) throw ApiError.notFound("Return request not found");
    return applyAction(actor, req, uuid, action, input);
  },

  /**
   * The two steps the customer drives themselves: entering the courier and
   * tracking number once they have posted the parcel, and pulling the request
   * before it ships. Everything else stays with the admin.
   */
  async performCustomerAction(
    sessionUserId: string,
    uuid: string,
    action: ReturnAction,
    input: RequestActionInput = {}
  ) {
    if (!RETURN_CUSTOMER_ACTIONS.includes(action)) {
      throw ApiError.forbidden("This action can only be performed by our team.");
    }
    const customerId = await resolveCustomerId(sessionUserId);
    const req = await returnRepository.findByUuid(uuid, customerId);
    if (!req) throw ApiError.notFound("Return request not found");
    return applyAction({ id: customerId, type: "USER" }, req, uuid, action, input);
  },
};

async function applyAction(
  actor: Actor,
  req: NonNullable<Awaited<ReturnType<typeof returnRepository.findByUuid>>>,
  uuid: string,
  action: ReturnAction,
  input: RequestActionInput = {}
) {
  const rule = RETURN_TRANSITIONS[action];
    if (!rule) throw ApiError.notFound("Unknown action");

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

    const qcFailureReason = (input.qcFailureReason ?? input.comment ?? "").trim();
    if (action === "qc-fail" && qcFailureReason.length < 3) {
      throw ApiError.badRequest("A quality check failure reason is required");
    }

    let shipDeadlineAt: Date | undefined;
    if (action === "approve") {
      shipDeadlineAt = getShipWindow(new Date()).deadline ?? undefined;
    }

    // The customer picks their own courier, so the carrier is free text and is
    // deliberately not matched against the original delivery shipment. The slip
    // photo is the proof that the parcel was actually posted, so it is required.
    let shippedAt: Date | undefined;
    let shippingSlipUrl: string | undefined;
    if (action === "shipped") {
      const courier = (input.courierName ?? req.courier_name ?? "").trim();
      const tracking = (input.trackingNumber ?? req.tracking_number ?? "").trim();
      if (!courier) throw ApiError.badRequest("Courier name is required");
      if (!tracking) throw ApiError.badRequest("Tracking number is required");

      const slip = (input.shippingSlipUrl ?? req.shipping_slip_url ?? "").trim();
      if (!slip) throw ApiError.badRequest(SHIPPING_SLIP_MANDATORY_NOTICE);
      // Checked against the request's owner, so an admin entering the details
      // on the customer's behalf still validates the customer's own upload.
      shippingSlipUrl = await slipService.assertUsableSlip(req.user_id, slip, {
        allowAdminUpload: actor.type !== "USER",
      });

      if (input.shippedDate) {
        shippedAt = new Date(input.shippedDate);
        if (Number.isNaN(shippedAt.getTime())) throw ApiError.badRequest("Invalid shipped date");
      }
    }

    // The item is the customer's once the check fails, so posting it back is
    // not optional and neither is the paper trail for it.
    let sendbackShippedAt: Date | undefined;
    if (action === "send-back") {
      const courier = (input.sendbackCourierName ?? "").trim();
      const tracking = (input.sendbackTrackingNumber ?? "").trim();
      if (courier.length < 2) {
        throw ApiError.badRequest("Enter the courier the item is being sent back with");
      }
      if (tracking.length < 3) {
        throw ApiError.badRequest("Enter the tracking / AWB number for the item sent back");
      }
      if (input.sendbackShippedDate) {
        sendbackShippedAt = new Date(input.sendbackShippedDate);
        if (Number.isNaN(sendbackShippedAt.getTime())) {
          throw ApiError.badRequest("Invalid send-back date");
        }
      }
    }

    if (action === "expire") {
      // Prefer the deadline stored at approval; fall back to recomputing it for
      // requests approved before that column existed.
      const deadline = req.ship_deadline_at ?? getShipWindow(req.approved_at).deadline;
      if (!deadline || Date.now() <= deadline.getTime()) {
        throw ApiError.badRequest(
          "The customer's shipping deadline has not passed yet, so this request cannot be expired."
        );
      }
    }

    const updated = await returnRepository.transition({
      request: { id: req.id, status: current, orderId: req.order_id },
      action,
      to: rule.to,
      actor,
      comment: input.comment,
      rejectionReason: action === "reject" ? rejectionReason : undefined,
      qcFailureReason: action === "qc-fail" ? qcFailureReason : undefined,
      cancellationReason: action === "cancel" ? input.cancellationReason : undefined,
      shipDeadlineAt,
      shippedAt,
      transactionRef: input.transactionRef,
      courierName: input.courierName,
      trackingNumber: input.trackingNumber,
      shippingSlipUrl,
      pickupImageUrl: input.pickupImageUrl,
      note: input.note,
      // Defaults to restocking, so an older client that sends no disposition
      // behaves exactly as before.
      disposition: action === "refund" ? (input.disposition ?? "restock") : undefined,
      sendbackCourierName: input.sendbackCourierName,
      sendbackTrackingNumber: input.sendbackTrackingNumber,
      sendbackShippedAt,
      sendbackProofUrl: input.sendbackProofUrl,
      receivedVariants: action === "refund" ? input.receivedVariants : undefined,
    });

    if (action === "refund") {
      const gatewayRefund = await settleRefundAtGateway(req.id, req.order_id, actor);
      // The attempt adds a timeline row, so hand back the request as it now stands.
      const refreshed = (await returnRepository.findByUuid(uuid)) ?? updated;
      return { ...formatRequest(refreshed), gatewayRefund };
    }

    return formatRequest(updated);
}
