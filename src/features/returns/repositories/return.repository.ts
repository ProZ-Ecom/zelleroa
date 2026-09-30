import crypto from "crypto";
import { voidCommissions } from "@/features/agents/services/commission.service";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { recordStockMovement } from "@/features/inventory/services/stock-ledger.service";
import { Prisma } from "@/generated/prisma";
import { adminReturnInclude } from "../lib/includes";
import { findItemConflicts, lockOrder } from "../lib/guards";
import type { ReturnAction, ReturnStatus } from "../lib/policy";
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
}

export interface TransitionParams {
  request: { id: bigint; status: ReturnStatus; orderId: bigint };
  action: ReturnAction;
  to: ReturnStatus;
  actor: Actor;
  comment?: string;
  rejectionReason?: string;
  pickupAt?: Date;
  note?: string;
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

  /** Applies one workflow step atomically, with its side effects and audit row. */
  async transition(p: TransitionParams) {
    return db.$transaction(async (tx) => {
      const now = new Date();

      // Optimistic guard: only succeeds if nobody moved the request meanwhile.
      const data: Prisma.return_requestsUpdateManyMutationInput & { updated_by: bigint } = {
        status: p.to,
        updated_at: now,
        updated_by: p.actor.id,
      };
      if (p.action === "approve") {
        Object.assign(data, { approved_at: now, approved_by: p.actor.id, admin_comment: p.comment ?? null });
      } else if (p.action === "reject") {
        Object.assign(data, {
          rejected_at: now,
          rejected_by: p.actor.id,
          rejection_reason: p.rejectionReason,
          admin_comment: p.comment ?? null,
        });
      } else if (p.action === "pickup") {
        Object.assign(data, { pickup_scheduled_at: p.pickupAt ?? now });
      } else if (p.action === "complete" || p.action === "close") {
        Object.assign(data, { completed_at: now });
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
            select: { id: true, quantity: true, total_price: true, variantUnitPriceId: true },
          },
        },
      });
      const orderId = p.request.orderId;
      let historyNote = p.rejectionReason ?? p.note ?? p.comment ?? null;

      if (p.action === "received") {
        // Goods are physically back: put them on the shelf, one ledger row per line.
        const orderRow = await tx.order.findUnique({
          where: { id: orderId },
          select: { orderNumber: true },
        });
        for (const item of items) {
          if (!item.order_items.variantUnitPriceId) continue;
          await recordStockMovement(tx, {
            variantUnitPriceId: item.order_items.variantUnitPriceId,
            movementType: "RETURN",
            direction: "in",
            quantity: item.quantity,
            referenceType: "return_request",
            referenceId: p.request.id,
            referenceNumber: orderRow?.orderNumber,
            reason: "Returned item received",
            actorId: p.actor.id,
          });
        }

        await voidCommissions(tx, {
          orderId,
          orderItemIds: items.map((i) => i.order_item_id),
          kind: "returned",
          reason: "Item returned",
          actor: { id: p.actor.id, role: "ADMIN" },
        });

        // Whole order back? then the order itself becomes "returned".
        const received = await tx.return_items.findMany({
          where: {
            is_active: true,
            return_requests: {
              is_active: true,
              order_id: orderId,
              status: { in: ["received", "refund_pending", "refunded", "closed"] },
              rejected_at: null,
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
        // this request's own rows are already flipped to "received" by the update above
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
              note: "All items returned and received",
              changed_by: p.actor.id,
              created_by: p.actor.id,
              updated_by: p.actor.id,
            },
          });
        }
      }

      if (p.action === "refund") {
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
          data: { status: "completed", processed_at: now, updated_by: p.actor.id },
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
        await tx.order_status_history.create({
          data: {
            order_id: orderId,
            status: "returned",
            note: `Refund of ₹${refunded.toFixed(2)} completed`,
            changed_by: p.actor.id,
            created_by: p.actor.id,
            updated_by: p.actor.id,
          },
        });
        historyNote = refunds.count > 0 ? "Refund completed" : "Marked refunded";
      }

      await tx.return_request_history.create({
        data: {
          return_request_id: p.request.id,
          from_status: p.request.status,
          to_status: p.to,
          action: p.action,
          note: historyNote?.slice(0, 500) ?? null,
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
