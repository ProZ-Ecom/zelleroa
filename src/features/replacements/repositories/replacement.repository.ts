import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { recordStockMovement } from "@/features/inventory/services/stock-ledger.service";
import { Prisma } from "@/generated/prisma";
import { adminReplacementInclude } from "@/features/returns/lib/includes";
import { findItemConflicts, lockOrder } from "@/features/returns/lib/guards";
import type { ReplacementAction, ReplacementStatus } from "@/features/returns/lib/policy";
import type { Actor } from "@/features/returns/repositories/return.repository";
import type { ReplacementListInput } from "../validations/replacement.schema";

function sortColumn(sortBy?: string) {
  return sortBy === "createdAt" ? "created_at" : sortBy === "updatedAt" ? "updated_at" : sortBy === "approvedAt" ? "approved_at" : "requested_at";
}

async function list(base: Prisma.replacement_requestsWhereInput, params: ReplacementListInput) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const s = params.search?.trim();
  const where: Prisma.replacement_requestsWhereInput = {
    ...base,
    is_active: true,
    ...(params.status ? { status: params.status } : {}),
    ...(s
      ? {
          OR: [
            { reason: { contains: s } },
            { uuid: { contains: s } },
            { orders: { orderNumber: { contains: s } } },
            { user: { name: { contains: s } } },
            { user: { email: { contains: s } } },
            { user: { phone: { contains: s } } },
          ],
        }
      : {}),
  };
  const [requests, total] = await Promise.all([
    db.replacement_requests.findMany({
      where,
      orderBy: { [sortColumn(params.sortBy)]: params.sortOrder ?? "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: adminReplacementInclude,
    }),
    db.replacement_requests.count({ where }),
  ]);
  return { requests, total, page, limit };
}

export interface CreateReplacementParams {
  orderId: bigint;
  userId: bigint;
  reason: string;
  description?: string | null;
  unboxingVideoUrl: string;
  items: {
    orderItemId: bigint;
    quantity: number;
    requestedVariantId: bigint;
    requestedVariantUnitPriceId: bigint;
    label: string;
  }[];
}

export interface ReplacementTransitionParams {
  request: { id: bigint; status: ReplacementStatus; orderId: bigint };
  action: ReplacementAction;
  to: ReplacementStatus;
  actor: Actor;
  comment?: string;
  rejectionReason?: string;
  pickupAt?: Date;
  note?: string;
}

export const replacementRepository = {
  list: (params: ReplacementListInput, customerId?: bigint) =>
    list(customerId ? { user_id: customerId } : {}, params),

  findByUuid(uuid: string, customerId?: bigint) {
    return db.replacement_requests.findFirst({
      where: { uuid, is_active: true, ...(customerId ? { user_id: customerId } : {}) },
      include: adminReplacementInclude,
    });
  },

  async create(p: CreateReplacementParams) {
    return db.$transaction(async (tx) => {
      await lockOrder(tx, p.orderId);

      const conflicts = await findItemConflicts(tx, p.items.map((i) => i.orderItemId));
      if (conflicts.length > 0) {
        const c = conflicts[0];
        const label = p.items.find((i) => i.orderItemId === c.orderItemId)?.label ?? "item";
        throw ApiError.conflict(`An active ${c.kind} request already exists for '${label}'.`);
      }

      return tx.replacement_requests.create({
        data: {
          uuid: crypto.randomUUID(),
          order_id: p.orderId,
          user_id: p.userId,
          reason: p.reason,
          description: p.description || null,
          unboxing_video_url: p.unboxingVideoUrl,
          status: "replacement_requested",
          created_by: p.userId,
          updated_by: p.userId,
          items: {
            create: p.items.map((i) => ({
              order_item_id: i.orderItemId,
              quantity: i.quantity,
              requested_variant_id: i.requestedVariantId,
              requested_variant_unit_price_id: i.requestedVariantUnitPriceId,
            })),
          },
          history: {
            create: {
              from_status: null,
              to_status: "replacement_requested",
              action: "requested",
              note: p.description?.slice(0, 500) || null,
              actor_user_id: p.userId,
              actor_type: "USER",
            },
          },
        },
        include: adminReplacementInclude,
      });
    });
  },

  async transition(p: ReplacementTransitionParams) {
    return db.$transaction(async (tx) => {
      const now = new Date();
      const data: Record<string, unknown> = { status: p.to, updated_at: now, updated_by: p.actor.id };

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
      } else if (p.action === "ship") {
        Object.assign(data, { shipped_at: now });
      } else if (p.action === "complete") {
        Object.assign(data, { delivered_at: now });
      } else if (p.action === "close") {
        Object.assign(data, { completed_at: now });
      }
      if (p.comment && !["approve", "reject"].includes(p.action)) data.admin_comment = p.comment;

      const moved = await tx.replacement_requests.updateMany({
        where: { id: p.request.id, status: p.request.status },
        data,
      });
      if (moved.count !== 1) {
        throw ApiError.conflict("This request was updated by someone else. Please refresh.");
      }

      let historyNote = p.rejectionReason ?? p.note ?? p.comment ?? null;

      // The replacement unit leaves the warehouse when processing starts.
      if (p.action === "process") {
        const orderNumber =
          (await tx.order.findUnique({ where: { id: p.request.orderId }, select: { orderNumber: true } }))
            ?.orderNumber ?? null;
        const items = await tx.replacement_request_items.findMany({
          where: { replacement_request_id: p.request.id, is_active: true },
          include: { order_items: { select: { variantUnitPriceId: true } } },
        });
        for (const item of items) {
          const returnedVupId = item.order_items.variantUnitPriceId;
          const vupId = item.requested_variant_unit_price_id ?? returnedVupId;
          const ref = {
            referenceType: "replacement_request",
            referenceId: p.request.id,
            referenceNumber: orderNumber,
            actorId: p.actor.id,
          };
          // 1) The original unit comes back from the customer (it was picked up
          //    before processing starts) and re-enters stock.
          if (returnedVupId) {
            await recordStockMovement(tx, {
              ...ref,
              variantUnitPriceId: returnedVupId,
              movementType: "REPLACEMENT",
              direction: "in",
              quantity: item.quantity,
              reason: "Replacement: original item received back",
            });
          }
          // 2) The replacement unit leaves stock. Never oversells: throws if short.
          if (vupId) {
            await recordStockMovement(tx, {
              ...ref,
              variantUnitPriceId: vupId,
              movementType: "REPLACEMENT",
              direction: "out",
              quantity: item.quantity,
              reason: "Replacement dispatched",
              itemLabel: "replacement item",
            });
          }
        }
        historyNote = historyNote ?? "Replacement being prepared";
      }

      await tx.replacement_request_history.create({
        data: {
          replacement_request_id: p.request.id,
          from_status: p.request.status,
          to_status: p.to,
          action: p.action,
          note: historyNote?.slice(0, 500) ?? null,
          actor_user_id: p.actor.id,
          actor_type: p.actor.type,
        },
      });

      return tx.replacement_requests.findUniqueOrThrow({
        where: { id: p.request.id },
        include: adminReplacementInclude,
      });
    });
  },
};
