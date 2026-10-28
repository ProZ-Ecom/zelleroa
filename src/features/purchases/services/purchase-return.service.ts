import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import type { Prisma } from "@/generated/prisma";
import { recordStockMovement } from "@/features/inventory/services/stock-ledger.service";
import { getAdminInternalId } from "./vendor.service";
import { productName, productSelect } from "./purchase-item.select";
import type {
  GetPurchaseReturnsParams,
  PurchaseReturnItemResponse,
  PurchaseReturnResponse,
  PurchaseReturnStatus,
  ReturnableOrder,
} from "../types";
import type {
  CreatePurchaseReturnInput,
  PurchaseReturnActionInput,
  UpdatePurchaseReturnInput,
} from "../validations/purchase-return.schema";

type Tx = Prisma.TransactionClient;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Only a received purchase has anything that can come back. */
const RECEIVABLE_STATUSES = ["PARTIALLY_RECEIVED", "RECEIVED"] as const;

export interface DamagedLine {
  purchaseOrderItemId: bigint;
  purchaseReceiptItemId: bigint;
  variantUnitPriceId: bigint;
  quantity: number;
  unitCost: Prisma.Decimal | number;
  notes?: string | null;
}

/**
 * Raises the debit note owed for units refused at the door.
 *
 * The goods never entered stock, so these lines are marked as not affecting it
 * and completing the return later must not take stock out again - it only
 * settles the money with the vendor. Created as a DRAFT so somebody checks it
 * before it is sent. Returns null when nothing was damaged.
 */
export async function createRejectionReturn(
  tx: Tx,
  po: { id: bigint; vendor_id: bigint; po_number: string; invoice_number: string | null },
  lines: DamagedLine[],
  adminId: bigint | null
): Promise<{ id: bigint; returnNumber: string } | null> {
  const damaged = lines.filter((l) => l.quantity > 0);
  if (damaged.length === 0) return null;

  const uuid = crypto.randomUUID();
  const total = damaged.reduce((sum, l) => sum + l.quantity * Number(l.unitCost), 0);

  const created = await tx.purchase_returns.create({
    data: {
      uuid,
      return_number: `TMP-${uuid.slice(0, 8)}`,
      purchase_order_id: po.id,
      vendor_id: po.vendor_id,
      status: "DRAFT",
      return_date: new Date(),
      notes: `Damaged on arrival against ${po.po_number}${po.invoice_number ? ` (Invoice ${po.invoice_number})` : ""}`,
      total_amount: round2(total),
      created_by: adminId,
      updated_by: adminId,
      items: {
        create: damaged.map((l) => ({
          purchase_order_item_id: l.purchaseOrderItemId,
          purchase_receipt_item_id: l.purchaseReceiptItemId,
          variant_unit_price_id: l.variantUnitPriceId,
          quantity: l.quantity,
          unit_cost: l.unitCost,
          affects_stock: false,
          reason: "DAMAGED",
          notes: l.notes?.slice(0, 255) ?? null,
        })),
      },
    },
    select: { id: true },
  });

  const returnNumber = `PR-${String(created.id).padStart(6, "0")}`;
  await tx.purchase_returns.update({
    where: { id: created.id },
    data: { return_number: returnNumber },
  });
  return { id: created.id, returnNumber };
}

const itemInclude = {
  variant_unit_price: {
    select: { sku: true, product_units: { select: { name: true } }, ...productSelect },
  },
} satisfies Prisma.purchase_return_itemsInclude;

const listInclude = {
  vendor: { select: { uuid: true, name: true, code: true, address: true, gstin: true } },
  purchase_order: { select: { uuid: true, po_number: true, invoice_number: true } },
  items: { select: { quantity: true, affects_stock: true } },
} satisfies Prisma.purchase_returnsInclude;

const detailInclude = {
  vendor: { select: { uuid: true, name: true, code: true, address: true, gstin: true } },
  purchase_order: { select: { uuid: true, po_number: true, invoice_number: true } },
  items: { include: itemInclude, orderBy: { id: "asc" as const } },
} satisfies Prisma.purchase_returnsInclude;

type DetailRow = Prisma.purchase_returnsGetPayload<{ include: typeof detailInclude }>;
type ListRow = Prisma.purchase_returnsGetPayload<{ include: typeof listInclude }>;

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function formatItem(i: DetailRow["items"][number]): PurchaseReturnItemResponse {
  const vup = i.variant_unit_price;
  return {
    id: Number(i.id),
    purchaseOrderItemId: Number(i.purchase_order_item_id),
    variantUnitPriceId: Number(i.variant_unit_price_id),
    productName: productName(vup),
    variantName: vup.variant?.variant_name || null,
    colorName: vup.variant?.color_name ?? null,
    sizeName: vup.attribute_value?.value ?? null,
    unitName: vup.product_units?.name ?? null,
    sku: vup.sku,
    quantity: i.quantity,
    unitCost: Number(i.unit_cost),
    lineTotal: round2(Number(i.unit_cost) * i.quantity),
    affectsStock: i.affects_stock,
    reason: i.reason,
    notes: i.notes,
  };
}

function format(r: ListRow | DetailRow): PurchaseReturnResponse {
  const items = "items" in r ? r.items : [];
  const detailed = items.length > 0 && "variant_unit_price" in items[0];
  return {
    id: r.uuid,
    returnNumber: r.return_number,
    status: r.status as PurchaseReturnStatus,
    vendor: {
      id: r.vendor.uuid,
      name: r.vendor.name,
      code: r.vendor.code,
      address: r.vendor.address,
      gstin: r.vendor.gstin,
    },
    purchaseOrder: {
      id: r.purchase_order.uuid,
      poNumber: r.purchase_order.po_number,
      invoiceNumber: r.purchase_order.invoice_number,
    },
    returnDate: isoDate(r.return_date),
    debitNoteNumber: r.debit_note_number,
    notes: r.notes,
    totalAmount: Number(r.total_amount),
    itemCount: items.length,
    stockUnits: items.reduce((n, i) => n + (i.affects_stock ? i.quantity : 0), 0),
    completedAt: r.completed_at ? r.completed_at.toISOString() : null,
    cancelledAt: r.cancelled_at ? r.cancelled_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    ...(detailed
      ? { items: (items as DetailRow["items"]).map(formatItem) }
      : {}),
  };
}

async function loadDetail(uuid: string) {
  const row = await db.purchase_returns.findUnique({ where: { uuid }, include: detailInclude });
  if (!row) throw ApiError.notFound("Purchase return not found");
  return format(row);
}

/**
 * Checks the requested lines against the purchase order and works out what to
 * store. Shared by create and update so a draft cannot be edited into something
 * the order never received.
 */
async function buildItems(
  purchaseOrderId: bigint,
  input: { purchaseOrderItemId: number; quantity: number; reason: string; notes: string | null }[],
  /** Lines on the draft being replaced; their quantities are not counted as already returned. */
  excludeReturnId?: bigint
) {
  const orderItems = await db.purchase_order_items.findMany({
    where: { purchase_order_id: purchaseOrderId },
    select: {
      id: true,
      variant_unit_price_id: true,
      quantity_received: true,
      quantity_returned: true,
      unit_cost: true,
      variant_unit_price: { select: { sku: true } },
    },
  });
  const byId = new Map(orderItems.map((i) => [Number(i.id), i]));

  // Other open drafts have not moved stock yet, but they have already claimed
  // part of what was received, so they count against what is still returnable.
  const pending = await db.purchase_return_items.groupBy({
    by: ["purchase_order_item_id"],
    where: {
      purchase_order_item_id: { in: orderItems.map((i) => i.id) },
      affects_stock: true,
      purchase_return: {
        status: { in: ["DRAFT", "SUBMITTED"] },
        ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
      },
    },
    _sum: { quantity: true },
  });
  const pendingById = new Map(pending.map((p) => [Number(p.purchase_order_item_id), p._sum.quantity ?? 0]));

  return input.map((line) => {
    const item = byId.get(line.purchaseOrderItemId);
    if (!item) throw ApiError.badRequest("A line does not belong to this purchase order");
    const available =
      item.quantity_received - item.quantity_returned - (pendingById.get(line.purchaseOrderItemId) ?? 0);
    if (line.quantity > available) {
      throw ApiError.badRequest(
        `${item.variant_unit_price.sku}: only ${Math.max(available, 0)} unit(s) can still be returned`
      );
    }
    return {
      purchase_order_item_id: item.id,
      variant_unit_price_id: item.variant_unit_price_id,
      quantity: line.quantity,
      unit_cost: item.unit_cost,
      affects_stock: true,
      reason: line.reason as PurchaseReturnItemResponse["reason"],
      notes: line.notes,
    };
  });
}

const totalOf = (items: { quantity: number; unit_cost: Prisma.Decimal }[]) =>
  round2(items.reduce((sum, i) => sum + i.quantity * Number(i.unit_cost), 0));

export const purchaseReturnService = {
  async list(params: GetPurchaseReturnsParams) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const where: Prisma.purchase_returnsWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.vendorId ? { vendor: { uuid: params.vendorId } } : {}),
      ...(params.search
        ? {
            OR: [
              { return_number: { contains: params.search } },
              { debit_note_number: { contains: params.search } },
              { vendor: { name: { contains: params.search } } },
              { purchase_order: { po_number: { contains: params.search } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db.purchase_returns.findMany({
        where,
        include: listInclude,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.purchase_returns.count({ where }),
    ]);
    return {
      data: rows.map(format),
      meta: { page, limit: pageSize, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  get: loadDetail,

  /** What is still sendable back on a purchase order, for the new-return form. */
  async returnable(poUuid: string): Promise<ReturnableOrder> {
    const po = await db.purchase_orders.findUnique({
      where: { uuid: poUuid },
      include: {
        vendor: { select: { uuid: true, name: true, code: true } },
        items: {
          orderBy: { id: "asc" },
          include: {
            variant_unit_price: {
              select: {
                sku: true,
                product_units: { select: { name: true } },
                inventories: { select: { quantity_available: true } },
                ...productSelect,
              },
            },
          },
        },
      },
    });
    if (!po) throw ApiError.notFound("Purchase order not found");
    if (!RECEIVABLE_STATUSES.includes(po.status as (typeof RECEIVABLE_STATUSES)[number])) {
      throw ApiError.badRequest("Only a received purchase order can have goods returned");
    }

    const pending = await db.purchase_return_items.groupBy({
      by: ["purchase_order_item_id"],
      where: {
        purchase_order_item_id: { in: po.items.map((i) => i.id) },
        affects_stock: true,
        purchase_return: { status: { in: ["DRAFT", "SUBMITTED"] } },
      },
      _sum: { quantity: true },
    });
    const pendingById = new Map(pending.map((p) => [Number(p.purchase_order_item_id), p._sum.quantity ?? 0]));

    return {
      id: po.uuid,
      poNumber: po.po_number,
      invoiceNumber: po.invoice_number,
      purchaseDate: isoDate(po.purchase_date),
      vendor: { id: po.vendor.uuid, name: po.vendor.name, code: po.vendor.code },
      items: po.items
        .map((i) => {
          const vup = i.variant_unit_price;
          const claimed = i.quantity_returned + (pendingById.get(Number(i.id)) ?? 0);
          return {
            purchaseOrderItemId: Number(i.id),
            variantUnitPriceId: Number(i.variant_unit_price_id),
            productName: productName(vup),
            variantName: vup.variant?.variant_name || null,
            colorName: vup.variant?.color_name ?? null,
            sizeName: vup.attribute_value?.value ?? null,
            unitName: vup.product_units?.name ?? null,
            sku: vup.sku,
            quantityReceived: i.quantity_received,
            quantityReturned: i.quantity_returned,
            returnable: Math.max(i.quantity_received - claimed, 0),
            unitCost: Number(i.unit_cost),
            currentStock: vup.inventories?.quantity_available ?? 0,
          };
        })
        .filter((i) => i.returnable > 0),
    };
  },

  async create(input: CreatePurchaseReturnInput, adminEmail?: string | null) {
    const po = await db.purchase_orders.findUnique({
      where: { uuid: input.purchaseOrderId },
      select: { id: true, vendor_id: true, status: true },
    });
    if (!po) throw ApiError.notFound("Purchase order not found");
    if (!RECEIVABLE_STATUSES.includes(po.status as (typeof RECEIVABLE_STATUSES)[number])) {
      throw ApiError.badRequest("Only a received purchase order can have goods returned");
    }

    const items = await buildItems(po.id, input.items);
    const adminId = await getAdminInternalId(adminEmail);
    const uuid = crypto.randomUUID();

    await db.$transaction(async (tx) => {
      const created = await tx.purchase_returns.create({
        data: {
          uuid,
          return_number: `TMP-${uuid.slice(0, 8)}`,
          purchase_order_id: po.id,
          vendor_id: po.vendor_id,
          status: "DRAFT",
          return_date: input.returnDate ? new Date(input.returnDate) : new Date(),
          debit_note_number: input.debitNoteNumber,
          notes: input.notes,
          total_amount: totalOf(items),
          created_by: adminId,
          updated_by: adminId,
          items: { create: items },
        },
        select: { id: true },
      });
      await tx.purchase_returns.update({
        where: { id: created.id },
        data: { return_number: `PR-${String(created.id).padStart(6, "0")}` },
      });
    });
    return loadDetail(uuid);
  },

  async update(uuid: string, input: UpdatePurchaseReturnInput, adminEmail?: string | null) {
    const existing = await db.purchase_returns.findUnique({
      where: { uuid },
      select: { id: true, status: true, purchase_order_id: true },
    });
    if (!existing) throw ApiError.notFound("Purchase return not found");
    if (existing.status !== "DRAFT") {
      throw ApiError.badRequest("Only a draft purchase return can be edited");
    }

    const items = await buildItems(existing.purchase_order_id, input.items, existing.id);
    const adminId = await getAdminInternalId(adminEmail);

    await db.$transaction(async (tx) => {
      await tx.purchase_return_items.deleteMany({ where: { purchase_return_id: existing.id } });
      await tx.purchase_returns.update({
        where: { id: existing.id },
        data: {
          return_date: input.returnDate ? new Date(input.returnDate) : null,
          debit_note_number: input.debitNoteNumber,
          notes: input.notes,
          total_amount: totalOf(items),
          updated_by: adminId,
          items: { create: items },
        },
      });
    });
    return loadDetail(uuid);
  },

  /**
   * Moves a return through its states. Completing it is the point where stock
   * actually leaves - and only for the lines that ever reached stock, so a
   * damaged-on-arrival return settles the money without touching inventory.
   */
  async act(uuid: string, input: PurchaseReturnActionInput, adminEmail?: string | null) {
    const adminId = await getAdminInternalId(adminEmail);
    if (input.action === "cancel" && !input.reason) {
      throw ApiError.badRequest("A reason is required to cancel a purchase return");
    }

    await db.$transaction(async (tx) => {
      const found = await tx.purchase_returns.findUnique({ where: { uuid }, select: { id: true } });
      if (!found) throw ApiError.notFound("Purchase return not found");
      // Lock the row so two people completing at once cannot both move stock.
      await tx.$queryRaw`SELECT id FROM purchase_returns WHERE id = ${found.id} FOR UPDATE`;

      const ret = await tx.purchase_returns.findUniqueOrThrow({
        where: { id: found.id },
        include: {
          items: { include: { variant_unit_price: { select: { sku: true } } } },
          purchase_order: { select: { po_number: true } },
        },
      });

      const open = ret.status === "DRAFT" || ret.status === "SUBMITTED";
      if (input.action === "submit" && ret.status !== "DRAFT") {
        throw ApiError.badRequest(`Cannot submit a purchase return that is ${ret.status.toLowerCase()}`);
      }
      if (input.action !== "submit" && !open) {
        throw ApiError.badRequest(`Cannot ${input.action} a purchase return that is ${ret.status.toLowerCase()}`);
      }

      const now = new Date();
      const next: PurchaseReturnStatus =
        input.action === "submit" ? "SUBMITTED" : input.action === "complete" ? "COMPLETED" : "CANCELLED";

      // The status guard in the WHERE makes concurrent clicks safe: only one wins.
      const res = await tx.purchase_returns.updateMany({
        where: { id: ret.id, status: ret.status },
        data: {
          status: next,
          updated_by: adminId,
          ...(input.debitNoteNumber ? { debit_note_number: input.debitNoteNumber } : {}),
          ...(input.action === "complete" && { completed_at: now }),
          ...(input.action === "cancel" && { cancelled_at: now }),
          ...(input.action === "cancel" && input.reason
            ? { notes: `${ret.notes ? `${ret.notes}\n` : ""}Cancelled: ${input.reason}`.slice(0, 500) }
            : {}),
        },
      });
      if (res.count === 0) throw ApiError.conflict("Purchase return was changed by someone else");

      if (input.action !== "complete") return;

      for (const item of ret.items) {
        if (!item.affects_stock) continue;

        // Re-checked inside the lock: the goods may have sold since the draft was raised.
        const orderItem = await tx.purchase_order_items.findUniqueOrThrow({
          where: { id: item.purchase_order_item_id },
          select: { quantity_received: true, quantity_returned: true },
        });
        if (item.quantity > orderItem.quantity_received - orderItem.quantity_returned) {
          throw ApiError.badRequest(
            `${item.variant_unit_price.sku}: more units than are left to return on this purchase`
          );
        }

        await recordStockMovement(tx, {
          variantUnitPriceId: item.variant_unit_price_id,
          movementType: "PURCHASE_RETURN",
          direction: "out",
          quantity: item.quantity,
          referenceType: "purchase_return",
          referenceId: ret.id,
          referenceNumber: ret.return_number,
          reason: `Returned to vendor on ${ret.return_number} (${ret.purchase_order.po_number})`,
          actorId: adminId,
          itemLabel: item.variant_unit_price.sku,
        });
        await tx.purchase_order_items.update({
          where: { id: item.purchase_order_item_id },
          data: { quantity_returned: { increment: item.quantity } },
        });
      }
    });
    return loadDetail(uuid);
  },
};
