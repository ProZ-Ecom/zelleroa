import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import {
  AUTO_APPROVE_SETTING_KEY,
  DEFAULT_AUTO_APPROVE,
  DEFAULT_RETURN_PERIOD_DAYS,
  RETURN_PERIOD_SETTING_KEY,
  SYSTEM_ACTOR,
  type AuditActor,
} from "../constants";
import { writeAudit } from "./commission-audit";
import { calculateCommissionAmount, resolveCommissionRate } from "./commission-rate.service";
import { buildCommissionWhere, formatCommissionRow, commissionInclude } from "./commission.queries";
import type { CommissionFilters } from "../types";

type Client = Prisma.TransactionClient | typeof db;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getReturnPeriodDays(client: Client = db): Promise<number> {
  const setting = await client.settings.findUnique({ where: { key_name: RETURN_PERIOD_SETTING_KEY } });
  const days = Number(setting?.value);
  return Number.isFinite(days) && days >= 0 ? days : DEFAULT_RETURN_PERIOD_DAYS;
}

/** Whether a commission that clears its return period is approved without an admin. */
export async function getAutoApprove(client: Client = db): Promise<boolean> {
  const setting = await client.settings.findUnique({ where: { key_name: AUTO_APPROVE_SETTING_KEY } });
  if (!setting?.value) return DEFAULT_AUTO_APPROVE;
  return ["1", "true", "yes", "on"].includes(setting.value.trim().toLowerCase());
}

/**
 * Creates one commission per order item for an agent-attributed order. Runs
 * inside the order-creation transaction. Percentage and amount are frozen
 * here; later rate changes never touch existing rows. The UNIQUE index on
 * order_item_id (plus the existence check) prevents duplicates.
 *
 * The commissionable amount is the item's own line total (after item-level
 * offers) - shipping lives on the order, never on items, so it is excluded.
 */
export async function createCommissionsForOrder(tx: Prisma.TransactionClient, orderId: bigint) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      agent_id: true,
      referral_code: true,
      order_source: true,
      order_status: true,
      items: {
        where: { is_active: true },
        select: {
          id: true,
          productId: true,
          total_price: true,
          product: { select: { categoryId: true } },
        },
      },
    },
  });
  if (!order || !order.agent_id) return [];
  // A plain customer-direct order bought by the agent themselves never earns; own and agent-placed
  // (incl. walk-in) orders are explicit sources and do.
  if (order.agent_id === order.userId && order.order_source === "CUSTOMER_DIRECT") return [];

  const existing = await tx.commissions.findMany({
    where: { order_id: orderId },
    select: { order_item_id: true },
  });
  const seen = new Set(existing.map((c) => c.order_item_id));

  const created: bigint[] = [];
  let totalBase = 0;
  let totalCommission = 0;
  for (const item of order.items) {
    if (seen.has(item.id)) continue;

    const productAmount = Number(item.total_price);
    const categoryId = item.product.categoryId != null ? BigInt(item.product.categoryId) : null;
    const rate = await resolveCommissionRate(tx, item.productId, categoryId);
    if (rate.percentage <= 0 || productAmount <= 0) continue;

    const amount = calculateCommissionAmount(productAmount, rate.percentage);
    const commission = await tx.commissions.create({
      data: {
        uuid: crypto.randomUUID(),
        agent_id: order.agent_id,
        referral_code: order.referral_code,
        customer_id: order.userId,
        order_id: order.id,
        order_item_id: item.id,
        product_id: item.productId,
        category_id: categoryId,
        product_amount: productAmount,
        commission_percentage: rate.percentage,
        rate_source: rate.source,
        commission_amount: amount,
        status: "pending",
        order_status: order.order_status,
      },
    });
    created.push(commission.id);
    totalBase += productAmount;
    totalCommission += amount;
    await writeAudit(tx, {
      entityType: "commission",
      entityId: commission.id,
      agentId: order.agent_id,
      action: "commission_created",
      toStatus: "pending",
      actor: SYSTEM_ACTOR,
      metadata: {
        orderId: String(order.id),
        productAmount,
        percentage: rate.percentage,
        source: rate.source,
        amount,
      },
    });
  }
  // Freeze the order-level summary (blended % over the commissionable amount) on the order itself.
  if (created.length > 0) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        commission_amount: Math.round(totalCommission * 100) / 100,
        commission_percentage: totalBase > 0 ? Math.round((totalCommission * 10000) / totalBase) / 100 : 0,
      },
    });
  }
  return created;
}

export interface VoidItemParam {
  orderItemId: bigint;
  returnedQuantity?: number;
  totalQuantity?: number;
  totalPrice?: number;
}

export interface VoidParams {
  orderId: bigint;
  /** Limit to specific order items (partial return); omit to void the whole order. */
  orderItemIds?: bigint[];
  items?: VoidItemParam[];
  kind: "cancelled" | "returned";
  reason: string;
  actor: AuditActor;
}

/**
 * Recalculates the parent order's active commission amount and blended commission
 * percentage based on remaining active (non-cancelled, non-reversed) item commissions.
 */
export async function recalculateOrderCommission(tx: Prisma.TransactionClient, orderId: bigint) {
  const activeCommissions = await tx.commissions.findMany({
    where: {
      order_id: orderId,
      status: { notIn: ["cancelled", "reversed"] },
    },
    select: {
      product_amount: true,
      commission_amount: true,
    },
  });

  const totalBase = activeCommissions.reduce((sum, c) => sum + Number(c.product_amount), 0);
  const totalCommission = activeCommissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const blendedPercentage =
    totalBase > 0 ? Math.round((totalCommission * 10000) / totalBase) / 100 : 0;
  const roundedCommission = Math.round(totalCommission * 100) / 100;

  await tx.order.update({
    where: { id: orderId },
    data: {
      commission_amount: roundedCommission,
      commission_percentage: blendedPercentage,
    },
  });

  return { totalBase, totalCommission: roundedCommission, blendedPercentage };
}

/**
 * Cancels/reverses commissions for a cancelled or returned order (or items).
 *  - cancelled order, not yet approved  -> `cancelled`
 *  - returned, or already approved      -> `reversed`
 * A reversed commission that sits in an unpaid payout is pulled out of it and
 * the payout total is recalculated; one that was already paid is flagged
 * `clawback_due` so finance can recover it. Nothing is deleted.
 */
export async function voidCommissions(tx: Prisma.TransactionClient, params: VoidParams) {
  const rows = await tx.commissions.findMany({
    where: {
      order_id: params.orderId,
      status: { notIn: ["cancelled", "reversed"] },
      ...(params.orderItemIds ? { order_item_id: { in: params.orderItemIds } } : {}),
    },
  });
  if (rows.length === 0) return 0;

  const now = new Date();
  const touchedPayouts = new Set<bigint>();
  const itemsMap = new Map<string, VoidItemParam>();
  if (params.items) {
    for (const it of params.items) {
      itemsMap.set(String(it.orderItemId), it);
    }
  }

  for (const row of rows) {
    const itemParam = itemsMap.get(String(row.order_item_id));
    const isPartial =
      itemParam?.returnedQuantity != null &&
      itemParam?.totalQuantity != null &&
      itemParam.returnedQuantity > 0 &&
      itemParam.returnedQuantity < itemParam.totalQuantity;

    if (isPartial) {
      // Partial quantity returned on this line: reduce product_amount & commission_amount to kept units
      const keptQty = itemParam.totalQuantity! - itemParam.returnedQuantity!;
      const unitPrice = (itemParam.totalPrice ?? Number(row.product_amount)) / itemParam.totalQuantity!;
      const keptProductAmount = Math.round(unitPrice * keptQty * 100) / 100;
      const keptCommissionAmount = calculateCommissionAmount(
        keptProductAmount,
        Number(row.commission_percentage)
      );

      await tx.commissions.update({
        where: { id: row.id },
        data: {
          product_amount: keptProductAmount,
          commission_amount: keptCommissionAmount,
        },
      });

      await writeAudit(tx, {
        entityType: "commission",
        entityId: row.id,
        agentId: row.agent_id,
        action: "commission_partial_return_adjusted",
        fromStatus: row.status,
        toStatus: row.status,
        actor: params.actor,
        note: `Partial return (${itemParam.returnedQuantity} of ${itemParam.totalQuantity} units returned)`,
        metadata: {
          previousProductAmount: Number(row.product_amount),
          newProductAmount: keptProductAmount,
          previousCommissionAmount: Number(row.commission_amount),
          newCommissionAmount: keptCommissionAmount,
        },
      });
      continue;
    }

    const cancelOnly = params.kind === "cancelled" && (row.status === "pending" || row.status === "pending_approval");
    const toStatus = cancelOnly ? "cancelled" : "reversed";
    const inOpenPayout = row.status === "payout_requested" || row.status === "payout_approved";
    const wasPaid = row.status === "paid";

    await tx.commissions.update({
      where: { id: row.id },
      data: {
        status: toStatus,
        cancelled_at: cancelOnly ? now : row.cancelled_at,
        reversed_at: cancelOnly ? row.reversed_at : now,
        reversal_reason: params.reason.slice(0, 255),
        clawback_due: wasPaid,
        payout_id: inOpenPayout ? null : row.payout_id,
      },
    });
    if (inOpenPayout && row.payout_id) touchedPayouts.add(row.payout_id);

    await writeAudit(tx, {
      entityType: "commission",
      entityId: row.id,
      agentId: row.agent_id,
      action: cancelOnly ? "commission_cancelled" : "commission_reversed",
      fromStatus: row.status,
      toStatus,
      actor: params.actor,
      note: params.reason,
      metadata: {
        amount: Number(row.commission_amount),
        clawbackDue: wasPaid,
        payoutId: row.payout_id ? String(row.payout_id) : null,
      },
    });
  }

  for (const payoutId of touchedPayouts) {
    const payout = await tx.commission_payouts.findUnique({
      where: { id: payoutId },
      include: { commissions: { select: { commission_amount: true } } },
    });
    if (!payout) continue;
    const remaining =
      payout.commissions.reduce((sum, c) => sum + Math.round(Number(c.commission_amount) * 100), 0) / 100;
    const cancelled = remaining <= 0;
    await tx.commission_payouts.update({
      where: { id: payoutId },
      data: {
        amount: remaining,
        ...(cancelled
          ? { status: "cancelled", admin_note: "All commissions in this payout were reversed" }
          : {}),
      },
    });
    await writeAudit(tx, {
      entityType: "payout",
      entityId: payoutId,
      agentId: payout.agent_id,
      action: cancelled ? "payout_cancelled_after_reversal" : "payout_amount_adjusted",
      fromStatus: payout.status,
      toStatus: cancelled ? "cancelled" : payout.status,
      actor: params.actor,
      note: "Commission reversed after order was returned/cancelled",
      metadata: { previousAmount: Number(payout.amount), newAmount: remaining },
    });
  }

  // Recalculate parent order's commission amount and blended percentage
  await recalculateOrderCommission(tx, params.orderId);

  return rows.length;
}

/**
 * Restores reversed commissions when an approved return request expires or is cancelled.
 */
export async function restoreCommissions(
  tx: Prisma.TransactionClient,
  params: {
    orderId: bigint;
    orderItemIds?: bigint[];
    items?: VoidItemParam[];
    reason: string;
    actor: AuditActor;
  }
) {
  const rows = await tx.commissions.findMany({
    where: {
      order_id: params.orderId,
      ...(params.orderItemIds ? { order_item_id: { in: params.orderItemIds } } : {}),
    },
  });
  if (rows.length === 0) return 0;

  const itemsMap = new Map<string, VoidItemParam>();
  if (params.items) {
    for (const it of params.items) {
      itemsMap.set(String(it.orderItemId), it);
    }
  }

  let restoredCount = 0;
  for (const row of rows) {
    const itemParam = itemsMap.get(String(row.order_item_id));
    const isPartial =
      itemParam?.returnedQuantity != null &&
      itemParam?.totalQuantity != null &&
      itemParam.returnedQuantity > 0 &&
      itemParam.returnedQuantity < itemParam.totalQuantity;

    if (isPartial && itemParam.totalPrice != null) {
      const originalProductAmount = Number(itemParam.totalPrice);
      const originalCommissionAmount = calculateCommissionAmount(
        originalProductAmount,
        Number(row.commission_percentage)
      );
      await tx.commissions.update({
        where: { id: row.id },
        data: {
          product_amount: originalProductAmount,
          commission_amount: originalCommissionAmount,
        },
      });

      await writeAudit(tx, {
        entityType: "commission",
        entityId: row.id,
        agentId: row.agent_id,
        action: "commission_partial_return_restored",
        fromStatus: row.status,
        toStatus: row.status,
        actor: params.actor,
        note: params.reason,
        metadata: {
          restoredProductAmount: originalProductAmount,
          restoredCommissionAmount: originalCommissionAmount,
        },
      });
      restoredCount++;
    } else if (row.status === "reversed") {
      await tx.commissions.update({
        where: { id: row.id },
        data: {
          status: "pending",
          reversed_at: null,
          reversal_reason: null,
        },
      });

      await writeAudit(tx, {
        entityType: "commission",
        entityId: row.id,
        agentId: row.agent_id,
        action: "commission_restored",
        fromStatus: "reversed",
        toStatus: "pending",
        actor: params.actor,
        note: params.reason,
        metadata: {
          amount: Number(row.commission_amount),
        },
      });
      restoredCount++;
    }
  }

  if (restoredCount > 0) {
    await recalculateOrderCommission(tx, params.orderId);
  }
  return restoredCount;
}

/**
 * Called from every code path that changes an order's status, inside that
 * path's transaction, so commission state can never drift from order state.
 */
export async function syncCommissionsWithOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: bigint,
  status: string,
  actor: AuditActor
) {
  await tx.commissions.updateMany({ where: { order_id: orderId }, data: { order_status: status } });

  if (status === "delivered") {
    const days = await getReturnPeriodDays(tx);
    const now = new Date();
    const endsAt = new Date(now.getTime() + days * DAY_MS);
    const rows = await tx.commissions.findMany({
      where: { order_id: orderId, status: "pending", delivered_at: null },
      select: { id: true, agent_id: true },
    });
    for (const row of rows) {
      await tx.commissions.update({
        where: { id: row.id },
        data: { delivered_at: now, return_period_ends_at: endsAt },
      });
      await writeAudit(tx, {
        entityType: "commission",
        entityId: row.id,
        agentId: row.agent_id,
        action: "return_period_started",
        fromStatus: "pending",
        toStatus: "pending",
        actor,
        metadata: { returnPeriodDays: days, returnPeriodEndsAt: endsAt.toISOString() },
      });
    }
  } else if (status === "cancelled") {
    await voidCommissions(tx, { orderId, kind: "cancelled", reason: "Order cancelled", actor });
  } else if (status === "returned") {
    await voidCommissions(tx, { orderId, kind: "returned", reason: "Order returned", actor });
  }
}

export const commissionService = {
  /**
   * Moves commissions whose return period has ended out of `pending`. There is no
   * scheduler in this app, so this runs lazily whenever commissions are read/requested.
   *
   * Where it lands depends on the `agent_commission_auto_approve` setting:
   *  - off (default) -> `pending_approval`; an admin must approve (see `approve`)
   *  - on            -> `approved` straight away, so the agent can request a payout
   *                     and the admin reviews the money once, on the payout
   */
  async markReadyForApproval(opts: { agentId?: bigint; actor?: AuditActor } = {}): Promise<number> {
    const actor = opts.actor ?? SYSTEM_ACTOR;
    const autoApprove = await getAutoApprove();

    // Backfill any delivered commissions that missed return_period_ends_at
    const unsyncedDelivered = await db.commissions.findMany({
      where: {
        status: "pending",
        delivered_at: null,
        order: { order_status: "delivered" },
      },
      select: { id: true, order: { select: { updatedAt: true } } },
      take: 100,
    });
    if (unsyncedDelivered.length > 0) {
      const days = await getReturnPeriodDays();
      for (const row of unsyncedDelivered) {
        const deliveredAt = row.order?.updatedAt ?? new Date();
        const endsAt = new Date(deliveredAt.getTime() + days * DAY_MS);
        await db.commissions.update({
          where: { id: row.id },
          data: { delivered_at: deliveredAt, return_period_ends_at: endsAt },
        });
      }
    }

    const due = await db.commissions.findMany({
      where: {
        status: "pending",
        delivered_at: { not: null },
        return_period_ends_at: { lte: new Date() },
        ...(opts.agentId ? { agent_id: opts.agentId } : {}),
        order_item: {
          return_items: {
            none: {
              is_active: true,
              return_requests: {
                status: { in: ["return_requested", "under_review"] },
                is_active: true,
              },
            },
          },
        },
      },
      select: { id: true, agent_id: true },
      take: 500,
    });

    if (due.length === 0) return 0;

    // One transaction for the whole batch; re-check status inside so a concurrent sweep can't double-audit.
    return db.$transaction(async (tx) => {
      const still = await tx.commissions.findMany({
        where: { id: { in: due.map((r) => r.id) }, status: "pending" },
        select: { id: true, agent_id: true },
      });
      if (still.length === 0) return 0;
      const toStatus = autoApprove ? "approved" : "pending_approval";
      await tx.commissions.updateMany({
        where: { id: { in: still.map((r) => r.id) }, status: "pending" },
        data: { status: toStatus, ...(autoApprove ? { approved_at: new Date() } : {}) },
      });
      for (const row of still) {
        await writeAudit(tx, {
          entityType: "commission",
          entityId: row.id,
          agentId: row.agent_id,
          action: autoApprove ? "commission_auto_approved" : "commission_ready_for_approval",
          fromStatus: "pending",
          toStatus,
          actor,
          note: autoApprove
            ? "Return period completed - auto-approved (admin approval not required)"
            : "Return period completed",
        });
      }
      return still.length;
    });
  },

  /**
   * Admin approval: `pending_approval` / `pending` -> `approved` (now withdrawable). `ids` = commission uuids;
   * omit to approve everything awaiting approval. The conditional update means a commission that was
   * returned/cancelled in the meantime is never approved.
   */
  async approve(opts: { ids?: string[]; actor: AuditActor }): Promise<number> {
    if (opts.actor.role !== "ADMIN" || !opts.actor.id) throw ApiError.forbidden("Only an admin can approve commissions");
    await this.markReadyForApproval({ actor: opts.actor });

    const rows = await db.commissions.findMany({
      where: {
        ...(opts.ids?.length
          ? {
              OR: [
                { status: "pending_approval" },
                {
                  status: "pending",
                  delivered_at: { not: null },
                  return_period_ends_at: { lte: new Date() },
                },
              ],
              uuid: { in: opts.ids },
            }
          : { status: "pending_approval" }),
        order_item: {
          return_items: {
            none: {
              is_active: true,
              return_requests: {
                status: { in: ["return_requested", "under_review"] },
                is_active: true,
              },
            },
          },
        },
      },
      select: { id: true, agent_id: true, status: true },
      take: 500,
    });

    if (opts.ids?.length && rows.length === 0) {
      const exists = await db.commissions.findFirst({
        where: { uuid: { in: opts.ids } },
        select: { status: true, delivered_at: true, return_period_ends_at: true },
      });
      if (!exists) {
        throw ApiError.notFound("Commission not found");
      }
      if (exists.status === "approved" || exists.status === "paid") {
        throw ApiError.badRequest("Commission is already approved or paid");
      }
      if (exists.status === "cancelled" || exists.status === "reversed") {
        throw ApiError.badRequest("Cancelled or reversed commissions cannot be approved");
      }
      if (!exists.delivered_at) {
        throw ApiError.badRequest("Commission cannot be approved before the order is delivered");
      }
      if (exists.return_period_ends_at && exists.return_period_ends_at > new Date()) {
        throw ApiError.badRequest("Commission cannot be approved before the return request deadline has expired");
      }
      throw ApiError.badRequest("Commission cannot be approved while a return request is under review");
    }

    let approved = 0;
    for (const row of rows) {
      await db.$transaction(async (tx) => {
        const res = await tx.commissions.updateMany({
          where: { id: row.id, status: row.status },
          data: { status: "approved", approved_at: new Date() },
        });
        if (res.count === 0) return;
        approved += 1;
        await writeAudit(tx, {
          entityType: "commission",
          entityId: row.id,
          agentId: row.agent_id,
          action: "commission_approved",
          fromStatus: row.status,
          toStatus: "approved",
          actor: opts.actor,
          note: "Approved by admin",
        });
      });
    }
    return approved;
  },

  async list(filters: CommissionFilters, scope: { agentId?: bigint } = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where = await buildCommissionWhere(filters, scope);

    const [rows, total] = await Promise.all([
      db.commissions.findMany({
        where,
        include: commissionInclude,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.commissions.count({ where }),
    ]);

    return {
      data: rows.map(formatCommissionRow),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async getAuditTrail(entityType: string, entityId: bigint) {
    return db.commission_audit_logs.findMany({
      where: { entity_type: entityType, entity_id: entityId },
      orderBy: { created_at: "asc" },
    });
  },
};
