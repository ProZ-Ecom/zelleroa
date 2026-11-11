import crypto from "crypto";
import { voidCommissions, restoreCommissions } from "@/features/agents/services/commission.service";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { recordStockMovement } from "@/features/inventory/services/stock-ledger.service";
import { Prisma } from "@/generated/prisma";
import { adminReturnInclude } from "../lib/includes";
import { findItemConflicts, lockOrder } from "../lib/guards";
import type { ReturnAction, ReturnDisposition, ReturnStatus } from "../lib/policy";
import type {
  AdminReturnListInput,
  CustomerReturnListInput,
} from "../validations/return.schema";

export interface Actor {
  id: bigint;
  type: "USER" | "ADMIN" | "STAFF" | "SYSTEM";
}

export async function findOrderForRequest(orderUuid: string) {
  return db.order.findFirst({
    where: { uuid: orderUuid, is_active: true },
    include: {
      items: { where: { is_active: true } },
      order_status_history: { where: { is_active: true } },
    },
  });
}

function sortColumn(sortBy: string | undefined) {
  switch (sortBy) {
    case "createdAt":
      return "created_at";
    case "updatedAt":
      return "updated_at";
    case "approvedAt":
      return "approved_at";
    default:
      return "requested_at";
  }
}

function searchWhere(search?: string): Prisma.return_requestsWhereInput | undefined {
  const s = search?.trim();
  if (!s) return undefined;
  return {
    OR: [
      { reason: { contains: s } },
      { uuid: { contains: s } },
      { orders: { orderNumber: { contains: s } } },
      { users_return_requests_user_idTousers: { name: { contains: s } } },
      { users_return_requests_user_idTousers: { email: { contains: s } } },
      { users_return_requests_user_idTousers: { phone: { contains: s } } },
    ],
  };
}

async function list(
  base: Prisma.return_requestsWhereInput,
  params: CustomerReturnListInput | AdminReturnListInput
) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const where: Prisma.return_requestsWhereInput = {
    ...base,
    is_active: true,
    ...(params.status ? { status: params.status } : {}),
    ...searchWhere(params.search),
  };
  const [requests, total] = await Promise.all([
    db.return_requests.findMany({
      where,
      orderBy: { [sortColumn(params.sortBy)]: params.sortOrder ?? "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: adminReturnInclude,
    }),
    db.return_requests.count({ where }),
  ]);
  return { requests, total, page, limit };
}

export interface CreateReturnParams {
  orderId: bigint;
  userId: bigint;
  reason: string;
  description?: string | null;
  unboxingVideoUrl: string;
  items: { orderItemId: bigint; quantity: number; refundAmount: number; label: string }[];
  codRefundDetails?: {
    method: "bank_transfer" | "upi";
    accountHolderName?: string;
    bankName?: string;
    accountNumberEnc?: string;
    accountLast4?: string;
    ifscCode?: string;
    upiId?: string;
  };
}

export interface TransitionParams {
  request: { id: bigint; status: ReturnStatus; orderId: bigint };
  action: ReturnAction;
  to: ReturnStatus;
  actor: Actor;
  comment?: string;
  rejectionReason?: string;
  /** `qc-fail` only: why the returned item failed the quality check. */
  qcFailureReason?: string;
  /** `cancel` only: why the customer pulled the request. */
  cancellationReason?: string;
  pickupAt?: Date;
  /** `approve` only: last day the customer may ship the item back. */
  shipDeadlineAt?: Date;
  /** `shipped` only: when the customer handed the parcel to the courier. */
  shippedAt?: Date;
  transactionRef?: string;
  courierName?: string;
  trackingNumber?: string;
  /** `shipped` only: the courier / delivery slip photo, mandatory for returns. */
  shippingSlipUrl?: string;
  pickupImageUrl?: string;
  note?: string;
  /**
   * `refund` only: what happens to the inspected item. "restock" puts it back
   * into sellable stock; "damaged" takes it in and writes it straight off.
   */
  disposition?: ReturnDisposition;
  /** `send-back` only: the leg back to the customer after a failed check. */
  sendbackCourierName?: string;
  sendbackTrackingNumber?: string;
  sendbackShippedAt?: Date;
  sendbackProofUrl?: string;
  /**
   * `refund` only: the SKU that actually arrived per returned line, keyed by
   * the order item's uuid. Only set where it differs from what was ordered.
   */
  receivedVariants?: { orderItemId: string; variantUnitPriceId: number }[];
}

export const returnRepository = {
  findOrderForRequest,

  async create(params: CreateReturnParams) {
    return db.$transaction(async (tx) => {
      await lockOrder(tx, params.orderId);

      const conflicts = await findItemConflicts(
        tx,
        params.items.map((i) => i.orderItemId)
      );
      if (conflicts.length > 0) {
        const c = conflicts[0];
        const label = params.items.find((i) => i.orderItemId === c.orderItemId)?.label ?? "item";
        throw ApiError.conflict(
          `An active ${c.kind} request already exists for '${label}'.`
        );
      }

      const now = new Date();
      const created = await tx.return_requests.create({
        data: {
          uuid: crypto.randomUUID(),
          order_id: params.orderId,
          user_id: params.userId,
          reason: params.reason,
          description: params.description || null,
          unboxing_video_url: params.unboxingVideoUrl,
          status: "return_requested",
          refund_method: params.codRefundDetails?.method ?? null,
          bank_account_holder: params.codRefundDetails?.accountHolderName ?? null,
          bank_name: params.codRefundDetails?.bankName ?? null,
          bank_account_number_enc: params.codRefundDetails?.accountNumberEnc ?? null,
          bank_account_last4: params.codRefundDetails?.accountLast4 ?? null,
          bank_ifsc: params.codRefundDetails?.ifscCode?.toUpperCase() ?? null,
          upi_id: params.codRefundDetails?.upiId ?? null,
          requested_at: now,
          created_by: params.userId,
          updated_by: params.userId,
          return_items: {
            create: params.items.map((i) => ({
              order_item_id: i.orderItemId,
              quantity: i.quantity,
              reason: params.reason,
              refund_amount: i.refundAmount,
              created_by: params.userId,
              updated_by: params.userId,
            })),
          },
          history: {
            create: {
              from_status: null,
              to_status: "return_requested",
              action: "requested",
              note: params.description?.slice(0, 500) || null,
              actor_user_id: params.userId,
              actor_type: "USER",
            },
          },
        },
        include: adminReturnInclude,
      });
      return created;
    });
  },

  listForCustomer(customerId: bigint, params: CustomerReturnListInput) {
    return list({ user_id: customerId }, params);
  },

  listForAdmin(params: AdminReturnListInput) {
    return list({}, params);
  },

  findByUuid(uuid: string, customerId?: bigint) {
    return db.return_requests.findFirst({
      where: { uuid, is_active: true, ...(customerId ? { user_id: customerId } : {}) },
      include: adminReturnInclude,
    });
  },

  /** The refund row the `refund` transition opened, still awaiting settlement. */
  findPendingRefund(requestId: bigint) {
    return db.refunds.findFirst({
      where: { return_request_id: requestId, status: "initiated", is_active: true },
      orderBy: { id: "desc" },
      select: { id: true, amount: true, payment_id: true },
    });
  },

  /**
   * Files the result of an automatic gateway refund against that row. Runs on
   * its own, after the transition has committed: the gateway call cannot be
   * rolled back, and a failure must leave the refund row `initiated` so the
   * admin can still settle it by hand and mark the request refunded.
   */
  async recordGatewayRefundOutcome(p: {
    requestId: bigint;
    refundId: bigint;
    paymentId: bigint;
    actor: Actor;
    outcome:
      | { ok: true; transactionRef: string; amount: number; gatewayResponse: unknown }
      | { ok: false; message: string };
  }) {
    const now = new Date();
    await db.$transaction(async (tx) => {
      if (p.outcome.ok) {
        await tx.refunds.update({
          where: { id: p.refundId },
          data: {
            status: "processing",
            transaction_ref: p.outcome.transactionRef,
            updated_at: now,
            updated_by: p.actor.id,
          },
        });
        await tx.return_requests.update({
          where: { id: p.requestId },
          data: {
            refund_transaction_ref: p.outcome.transactionRef,
            updated_at: now,
            updated_by: p.actor.id,
          },
        });
        await tx.paymentTransaction.create({
          data: {
            paymentId: p.paymentId,
            transaction_type: "refund",
            amount: p.outcome.amount,
            status: "processing",
            gatewayResponse: p.outcome.gatewayResponse as Prisma.InputJsonValue,
            created_by: p.actor.id,
            updated_by: p.actor.id,
          },
        });
      }
      await tx.return_request_history.create({
        data: {
          return_request_id: p.requestId,
          from_status: "refund_pending",
          to_status: "refund_pending",
          action: "refund",
          note: (p.outcome.ok
            ? `Automatic refund sent to the payment gateway (Ref: ${p.outcome.transactionRef})`
            : `Automatic refund failed: ${p.outcome.message}`
          ).slice(0, 500),
          actor_user_id: p.actor.id,
          actor_type: p.actor.type,
        },
      });
    });
  },

  /** Applies one workflow step atomically, with its side effects and audit row. */
  async transition(p: TransitionParams) {
    return db.$transaction(async (tx) => {
      const now = new Date();

      // Optimistic guard: only succeeds if nobody moved the request meanwhile.
      // The *unchecked* input is the one that carries the relation-backed
      // foreign keys (`updated_by`, `created_by`); the checked variant omits
      // them, so passing one through it is rejected at runtime.
      const data: Prisma.return_requestsUncheckedUpdateManyInput = {
        status: p.to,
        updated_at: now,
        updated_by: p.actor.id,
      };
      let generatedReturnNumber: string | null = null;
      if (p.action === "approve") {
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
        const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
        generatedReturnNumber = `RET-${dateStr}-${randomHex}`;
        Object.assign(data, {
          approved_at: now,
          approved_by: p.actor.id,
          admin_comment: p.comment ?? null,
          return_number: generatedReturnNumber,
          ship_deadline_at: p.shipDeadlineAt ?? null,
        });
      } else if (p.action === "reject") {
        Object.assign(data, {
          rejected_at: now,
          rejected_by: p.actor.id,
          rejection_reason: p.rejectionReason,
          admin_comment: p.comment ?? null,
        });
      } else if (p.action === "shipped") {
        Object.assign(data, { shipped_at: p.shippedAt ?? now });
      } else if (p.action === "received") {
        Object.assign(data, { received_at: now });
      } else if (p.action === "qc-fail") {
        Object.assign(data, {
          qc_failed_at: now,
          qc_failure_reason: p.qcFailureReason ?? null,
          admin_comment: p.comment ?? null,
        });
      } else if (p.action === "send-back") {
        Object.assign(data, {
          sendback_courier_name: p.sendbackCourierName?.trim() || null,
          sendback_tracking_number: p.sendbackTrackingNumber?.trim() || null,
          sendback_shipped_at: p.sendbackShippedAt ?? now,
          sendback_proof_url: p.sendbackProofUrl?.trim() || null,
        });
      } else if (p.action === "delivered-back") {
        Object.assign(data, { sendback_delivered_at: now });
      } else if (p.action === "expire") {
        Object.assign(data, { expired_at: now });
      } else if (p.action === "cancel") {
        Object.assign(data, {
          cancelled_at: now,
          cancelled_by: p.actor.id,
          cancellation_reason: p.cancellationReason ?? null,
        });
      } else if (p.action === "complete" || p.action === "close") {
        Object.assign(data, {
          completed_at: now,
          // Must be part of this update: assigning it after `updateMany` ran
          // silently dropped a manually entered reference.
          ...(p.transactionRef ? { refund_transaction_ref: p.transactionRef } : {}),
        });
      }
      if (p.courierName !== undefined) {
        Object.assign(data, { courier_name: p.courierName.trim() || null });
      }
      if (p.trackingNumber !== undefined) {
        Object.assign(data, { tracking_number: p.trackingNumber.trim() || null });
      }
      if (p.pickupImageUrl !== undefined) {
        Object.assign(data, { pickup_image_url: p.pickupImageUrl.trim() || null });
      }
      if (p.shippingSlipUrl !== undefined) {
        Object.assign(data, { shipping_slip_url: p.shippingSlipUrl.trim() || null });
      }
      if (p.comment && !["approve", "reject"].includes(p.action)) {
        Object.assign(data, { admin_comment: p.comment });
      }

      const moved = await tx.return_requests.updateMany({
        where: { id: p.request.id, status: p.request.status },
        data,
      });
      if (moved.count !== 1) {
        throw ApiError.conflict("This request was updated by someone else. Please refresh.");
      }

      const items = await tx.return_items.findMany({
        where: { return_request_id: p.request.id, is_active: true },
        include: {
          order_items: {
            select: {
              id: true,
              uuid: true,
              quantity: true,
              total_price: true,
              variantUnitPriceId: true,
            },
          },
        },
      });
      const orderId = p.request.orderId;

      if (p.action === "approve") {
        await voidCommissions(tx, {
          orderId,
          orderItemIds: items.map((i) => i.order_item_id),
          items: items.map((i) => ({
            orderItemId: i.order_item_id,
            returnedQuantity: i.quantity,
            totalQuantity: i.order_items.quantity,
            totalPrice: Number(i.order_items.total_price),
          })),
          kind: "returned",
          reason: "Return request approved",
          actor: { id: p.actor.id, role: "ADMIN" },
        });
      } else if (p.action === "expire" || p.action === "cancel" || p.action === "delivered-back") {
        await restoreCommissions(tx, {
          orderId,
          orderItemIds: items.map((i) => i.order_item_id),
          items: items.map((i) => ({
            orderItemId: i.order_item_id,
            returnedQuantity: i.quantity,
            totalQuantity: i.order_items.quantity,
            totalPrice: Number(i.order_items.total_price),
          })),
          reason:
            p.action === "expire"
              ? "Return request expired"
              : p.action === "cancel"
                ? "Return request cancelled"
                : "Return item delivered back to customer after QC failure",
          actor: { id: p.actor.id, role: p.actor.type === "USER" ? "CUSTOMER" : "ADMIN" },
        });
      }

      let historyNote = p.rejectionReason ?? p.note ?? p.comment ?? null;

      if (p.action === "shipped" && !p.note && !p.comment) {
        const ret = await tx.return_requests.findUnique({
          where: { id: p.request.id },
          select: { return_number: true, courier_name: true, tracking_number: true },
        });
        const courier = p.courierName || ret?.courier_name;
        const tracking = p.trackingNumber || ret?.tracking_number;
        const courierStr = courier ? ` via ${courier}` : "";
        const trackingStr = tracking ? ` (Tracking no: ${tracking})` : "";
        historyNote = ret?.return_number
          ? `Item shipped by customer${courierStr}${trackingStr}. Return ID: ${ret.return_number}`
          : `Item shipped by customer${courierStr}${trackingStr}`;
      } else if (p.action === "received" && !p.note && !p.comment) {
        historyNote = "Returned item received. Quality check in progress.";
      } else if (p.action === "qc-fail") {
        historyNote = p.qcFailureReason
          ? `Quality check failed: ${p.qcFailureReason}`
          : "Quality check failed";
      } else if (p.action === "send-back" && !p.note && !p.comment) {
        const courier = p.sendbackCourierName?.trim();
        const tracking = p.sendbackTrackingNumber?.trim();
        historyNote = `Item sent back to the customer${courier ? ` via ${courier}` : ""}${
          tracking ? ` (Tracking no: ${tracking})` : ""
        }`;
      } else if (p.action === "delivered-back" && !p.note && !p.comment) {
        historyNote = "Item delivered back to the customer.";
      } else if (p.action === "refund" && !p.note && !p.comment) {
        historyNote =
          p.disposition === "damaged"
            ? "Quality check passed. The item arrived damaged and has been written off, so it is not resold. Refund initiated."
            : "Quality check passed. Item returned to sellable stock and refund initiated.";
      } else if (p.action === "expire" && !p.note && !p.comment) {
        historyNote = "Closed as the item was not shipped before the deadline";
      } else if (p.action === "cancel") {
        historyNote = p.cancellationReason
          ? `Return cancelled: ${p.cancellationReason}`
          : "Return request cancelled";
      }

      if (p.action === "refund") {
        // The quality check passed, so the goods are taken into our books. This
        // deliberately happens here and not on `received`: a QC failure must
        // never restock an item that is about to be sent back to the customer.
        //
        // A damaged item still gets booked in with a RETURN movement - that is
        // the record of the parcel physically arriving - and is then written
        // off with a DAMAGE movement in the same transaction. Net sellable
        // stock is unchanged, while the loss stays visible in the ledger
        // instead of silently never being recorded.
        const isDamaged = p.disposition === "damaged";
        // "Wrong product received": the parcel holds a different SKU from the
        // one on the order line. Crediting the ordered SKU would overstate it
        // and leave the SKU actually in our hands uncounted, so the arrival is
        // booked against what turned up.
        const arrivedByOrderItem = new Map(
          (p.receivedVariants ?? []).map((r) => [r.orderItemId, BigInt(r.variantUnitPriceId)])
        );
        if (arrivedByOrderItem.size > 0) {
          for (const item of items) {
            const key = item.order_items.uuid ?? String(item.order_items.id);
            const arrived = arrivedByOrderItem.get(key);
            if (arrived && arrived !== item.order_items.variantUnitPriceId) {
              await tx.return_items.updateMany({
                where: { id: item.id },
                data: {
                  received_variant_unit_price_id: arrived,
                  updated_by: p.actor.id,
                },
              });
            }
          }
        }
        const alreadyRestocked = await tx.inventoryTransaction.count({
          where: {
            referenceType: "return_request",
            referenceId: p.request.id,
            movement_type: "RETURN",
          },
        });
        if (alreadyRestocked === 0) {
          const orderRow = await tx.order.findUnique({
            where: { id: orderId },
            select: { orderNumber: true },
          });
          for (const item of items) {
            const orderedVupId = item.order_items.variantUnitPriceId;
            const arrivedVupId =
              arrivedByOrderItem.get(item.order_items.uuid ?? String(item.order_items.id)) ??
              item.received_variant_unit_price_id ??
              orderedVupId;
            if (!arrivedVupId) continue;
            const isWrongProduct = Boolean(orderedVupId) && arrivedVupId !== orderedVupId;
            await recordStockMovement(tx, {
              variantUnitPriceId: arrivedVupId,
              movementType: "RETURN",
              direction: "in",
              quantity: item.quantity,
              referenceType: "return_request",
              referenceId: p.request.id,
              referenceNumber: orderRow?.orderNumber,
              reason: isDamaged
                ? "Damaged item received back on a return"
                : isWrongProduct
                  ? "Wrong product received back on a return"
                  : "Returned item passed quality check",
              actorId: p.actor.id,
            });
            if (isDamaged) {
              await recordStockMovement(tx, {
                variantUnitPriceId: arrivedVupId,
                movementType: "DAMAGE",
                direction: "out",
                quantity: item.quantity,
                referenceType: "return_request",
                referenceId: p.request.id,
                referenceNumber: orderRow?.orderNumber,
                reason: p.comment?.trim()
                  ? `Written off - damaged on return: ${p.comment.trim()}`.slice(0, 255)
                  : "Written off - damaged on return, not resellable",
                actorId: p.actor.id,
              });
            }
          }
        }

        // Whole order back? then the order itself becomes "returned".
        const received = await tx.return_items.findMany({
          where: {
            is_active: true,
            return_requests: {
              is_active: true,
              order_id: orderId,
              status: { in: ["refund_pending", "refunded", "closed"] },
              rejected_at: null,
              qc_failed_at: null,
              cancelled_at: null,
              expired_at: null,
            },
          },
          select: { order_item_id: true, quantity: true },
        });
        const backById = new Map<string, number>();
        for (const r of received) {
          const k = String(r.order_item_id);
          backById.set(k, (backById.get(k) ?? 0) + r.quantity);
        }
        const orderItems = await tx.orderItem.findMany({
          where: { orderId, is_active: true },
          select: { id: true, quantity: true },
        });
        // this request's own rows are already flipped to "refund_pending" above
        const full = orderItems.every((oi) => (backById.get(String(oi.id)) ?? 0) >= oi.quantity);
        if (full) {
          await tx.order.update({
            where: { id: orderId },
            data: { order_status: "returned", updatedAt: now, updated_by: p.actor.id },
          });
          await tx.commissions.updateMany({ where: { order_id: orderId }, data: { order_status: "returned" } });
          await tx.order_status_history.create({
            data: {
              order_id: orderId,
              status: "returned",
              note: "All items returned and passed quality check",
              changed_by: p.actor.id,
              created_by: p.actor.id,
              updated_by: p.actor.id,
            },
          });
        }

        const amount = items.reduce((sum, i) => sum + Number(i.refund_amount ?? i.order_items.total_price), 0);
        let payment = await tx.payment.findFirst({ where: { orderId }, orderBy: { id: "asc" } });
        if (!payment) {
          let cod = await tx.payment_methods.findFirst({ where: { code: "COD" } });
          if (!cod) {
            cod = await tx.payment_methods.create({
              data: { name: "Cash on Delivery", code: "COD", is_active: true },
            });
          }
          const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { totalAmount: true } });
          payment = await tx.payment.create({
            data: {
              orderId,
              payment_method_id: cod.id,
              amount: order.totalAmount,
              currency: "INR",
              status: "success",
              created_by: p.actor.id,
              updated_by: p.actor.id,
            },
          });
        }
        await tx.refunds.create({
          data: {
            payment_id: payment.id,
            order_id: orderId,
            return_request_id: p.request.id,
            amount,
            reason: "Return approved",
            status: "initiated",
            created_by: p.actor.id,
            updated_by: p.actor.id,
          },
        });
        historyNote = `Refund of ₹${amount.toFixed(2)} initiated`;
      }

      if (p.action === "complete") {
        const refunds = await tx.refunds.updateMany({
          where: { return_request_id: p.request.id, status: { in: ["initiated", "processing"] } },
          data: {
            status: "completed",
            processed_at: now,
            // Left alone when no ref is typed, so an automatic gateway refund
            // keeps the reference it already recorded.
            ...(p.transactionRef ? { transaction_ref: p.transactionRef } : {}),
            updated_by: p.actor.id,
          },
        });
        const order = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          select: { totalAmount: true },
        });
        const agg = await tx.refunds.aggregate({
          where: { order_id: orderId, status: "completed" },
          _sum: { amount: true },
        });
        const refunded = Number(agg._sum.amount ?? 0);
        await tx.order.update({
          where: { id: orderId },
          data: {
            payment_status: refunded >= Number(order.totalAmount) ? "refunded" : "partial_refund",
            updatedAt: now,
            updated_by: p.actor.id,
          },
        });
        const refSuffix = p.transactionRef ? ` (Ref: ${p.transactionRef})` : "";
        await tx.order_status_history.create({
          data: {
            order_id: orderId,
            status: "returned",
            note: `Refund of ₹${refunded.toFixed(2)} completed${refSuffix}`,
            changed_by: p.actor.id,
            created_by: p.actor.id,
            updated_by: p.actor.id,
          },
        });
        historyNote = p.transactionRef
          ? `Refund completed (Ref: ${p.transactionRef})`
          : refunds.count > 0 ? "Refund completed" : "Marked refunded";
      }

      await tx.return_request_history.create({
        data: {
          return_request_id: p.request.id,
          from_status: p.request.status,
          to_status: p.to,
          action: p.action,
          note: (p.action === "approve"
            ? (generatedReturnNumber
                ? (p.comment ? `${p.comment} (Return ID: ${generatedReturnNumber})` : `Return approved. Return ID: ${generatedReturnNumber}`)
                : (p.comment ?? "Return approved"))
            : historyNote)?.slice(0, 500) ?? null,
          actor_user_id: p.actor.id,
          actor_type: p.actor.type,
        },
      });

      return tx.return_requests.findUniqueOrThrow({
        where: { id: p.request.id },
        include: adminReturnInclude,
      });
    });
  },
};
