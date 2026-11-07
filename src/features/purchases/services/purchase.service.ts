import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import type { Prisma } from "@/generated/prisma";
import type {
  GetPurchasesParams,
  PurchaseOrderResponse,
  PurchaseItemResponse,
  PurchaseProductOption,
  PurchaseStatus,
} from "../types";
import type {
  PurchaseOrderInput,
  PurchaseActionInput,
  ReceiveInput,
  ConfirmPurchaseInput,
} from "../validations/purchase.schema";
import { recordStockMovement } from "@/features/inventory/services/stock-ledger.service";
import { getAdminInternalId } from "./vendor.service";
import { createRejectionReturn, type DamagedLine } from "./purchase-return.service";
import { productName, productSelect } from "./purchase-item.select";

const itemInclude = {
  variant_unit_price: {
    include: {
      product_units: { select: { name: true, code: true } },
      ...productSelect,
    },
  },
} satisfies Prisma.purchase_order_itemsInclude;

type ItemRow = Prisma.purchase_order_itemsGetPayload<{ include: typeof itemInclude }>;

const listInclude = {
  vendor: { select: { uuid: true, name: true, code: true } },
  _count: { select: { items: true } },
} satisfies Prisma.purchase_ordersInclude;

const detailInclude = {
  vendor: { select: { uuid: true, name: true, code: true } },
  _count: { select: { items: true } },
  items: { include: itemInclude, orderBy: { id: "asc" as const } },
  history: { orderBy: { id: "asc" as const } },
  receipts: {
    orderBy: { id: "desc" as const },
    include: {
      items: {
        include: {
          variant_unit_price: { select: { sku: true, ...productSelect } },
        },
      },
    },
  },
} satisfies Prisma.purchase_ordersInclude;

function formatItem(i: ItemRow): PurchaseItemResponse {
  return {
    id: Number(i.id),
    variantUnitPriceId: Number(i.variant_unit_price_id),
    productName: productName(i.variant_unit_price),
    variantName: i.variant_unit_price.variant?.variant_name || null,
    colorName: i.variant_unit_price.variant?.color_name ?? null,
    sizeName: i.variant_unit_price.attribute_value?.value ?? null,
    unitName: i.variant_unit_price.product_units?.name ?? null,
    sku: i.variant_unit_price.sku,
    quantityOrdered: i.quantity_ordered,
    quantityReceived: i.quantity_received,
    unitCost: Number(i.unit_cost),
    lineTotal: Number(i.unit_cost) * i.quantity_ordered,
  };
}


function format(po: any): PurchaseOrderResponse {
  return {
    id: po.uuid,
    poNumber: po.po_number,
    status: po.status,
    vendor: { id: po.vendor.uuid, name: po.vendor.name, code: po.vendor.code },
   
expectedDate: po.expected_date
  ? `${String(po.expected_date.getUTCDate()).padStart(2, "0")}-${String(po.expected_date.getUTCMonth() + 1).padStart(2, "0")}-${po.expected_date.getUTCFullYear()}`
  : null,

purchaseDate: po.purchase_date
  ? `${String(po.purchase_date.getUTCDate()).padStart(2, "0")}-${String(po.purchase_date.getUTCMonth() + 1).padStart(2, "0")}-${po.purchase_date.getUTCFullYear()}`
  : null,

    invoiceNumber: po.invoice_number,
    notes: po.notes,
    rejectReason: po.reject_reason,
    subtotal: Number(po.subtotal),
    additionalCharges: Number(po.additional_charges),
    totalAmount: Number(po.total_amount),
    itemCount: po._count?.items ?? po.items?.length ?? 0,
    createdAt: po.created_at.toISOString(),
    approvedAt: po.approved_at ? po.approved_at.toISOString() : null,
    items: po.items?.map(formatItem),
    history: po.history?.map((h: any) => ({
      fromStatus: h.from_status,
      toStatus: h.to_status,
      note: h.note,
      createdAt: h.created_at.toISOString(),
    })),
    receipts: po.receipts?.map((r: any) => ({
      id: Number(r.id),
      receiptNumber: r.receipt_number,
      receivedAt: r.received_at.toISOString(),
      notes: r.notes,
      items: r.items.map((ri: any) => ({
        productName: productName(ri.variant_unit_price),
        sku: ri.variant_unit_price.sku,
        quantity: ri.quantity_received,
        unitCost: Number(ri.unit_cost),
      })),
    })),
  };
}

async function findByUuid(uuid: string) {
  const po = await db.purchase_orders.findUnique({ where: { uuid } });
  if (!po) throw ApiError.notFound("Purchase order not found");
  return po;
}

async function loadDetail(uuid: string) {
  const po = await db.purchase_orders.findUnique({ where: { uuid }, include: detailInclude });
  if (!po) throw ApiError.notFound("Purchase order not found");
  return format(po);
}

async function buildItems(items: PurchaseOrderInput["items"]) {
  const ids = [...new Set(items.map((i) => i.variantUnitPriceId))];
  if (ids.length !== items.length) {
    throw ApiError.badRequest("The same product is added more than once");
  }
  const found = await db.variantUnitPrice.count({
    where: { id: { in: ids.map(BigInt) }, isActive: true, deleted_at: null },
  });
  if (found !== ids.length) throw ApiError.badRequest("One or more products are unavailable");
  return items.map((i) => ({
    variant_unit_price_id: BigInt(i.variantUnitPriceId),
    quantity_ordered: i.quantity,
    unit_cost: i.unitCost,
  }));
}

function totalOf(items: { quantity_ordered: number; unit_cost: number }[]) {
  return items.reduce((sum, i) => sum + i.quantity_ordered * i.unit_cost, 0);
}

/** Header money + purchase details shared by create and update. */
function headerData(input: PurchaseOrderInput, items: { quantity_ordered: number; unit_cost: number }[]) {
  const subtotal = Math.round(totalOf(items) * 100) / 100;
  const additional = Math.round(input.additionalCharges * 100) / 100;
  return {
    expected_date: input.expectedDate ? new Date(input.expectedDate) : null,
    purchase_date: input.purchaseDate ? new Date(input.purchaseDate) : new Date(),
    invoice_number: input.invoiceNumber,
    notes: input.notes,
    subtotal,
    additional_charges: additional,
    total_amount: subtotal + additional,
  };
}

async function resolveVendor(vendorUuid: string) {
  const vendor = await db.vendors.findFirst({ where: { uuid: vendorUuid, deleted_at: null } });
  if (!vendor) throw ApiError.notFound("Vendor not found");
  if (!vendor.is_active) throw ApiError.badRequest("Vendor is inactive");
  return vendor;
}

type Tx = Prisma.TransactionClient;

export interface ReceiptLine {
  item: { id: bigint; variant_unit_price_id: bigint; unit_cost: Prisma.Decimal };
  /** Units accepted into stock. */
  quantity: number;
  /** Units refused at the door; billed by the vendor but never stocked. */
  damagedQuantity?: number;
  /** New customer-facing price to apply with this delivery, or null to leave it. */
  sellingPrice?: number | null;
  remarks?: string | null;
}

/**
 * Rolls the cost of this delivery into the SKU's running figures: `cost_price`
 * is simply the latest paid, `avg_cost` is weighted by the stock already held,
 * which is what stock valuation reads.
 *
 * A zero cost means "not known" (opening stock is received that way), so it is
 * left out of the average rather than dragging it towards zero.
 */
async function applyCost(
  tx: Tx,
  variantUnitPriceId: bigint,
  unitCost: number,
  quantity: number,
  stockBefore: number
) {
  if (unitCost <= 0 || quantity <= 0) return;

  const current = await tx.variantUnitPrice.findUnique({
    where: { id: variantUnitPriceId },
    select: { avg_cost: true },
  });
  const previousAvg = current?.avg_cost === null || current?.avg_cost === undefined ? null : Number(current.avg_cost);

  // Stock can be zero (or the average unknown) on the first purchase, and then
  // the delivery itself is the whole basis for the average.
  const heldValue = previousAvg !== null && stockBefore > 0 ? previousAvg * stockBefore : 0;
  const heldQty = previousAvg !== null && stockBefore > 0 ? stockBefore : 0;
  const avg = (heldValue + unitCost * quantity) / (heldQty + quantity);

  await tx.variantUnitPrice.update({
    where: { id: variantUnitPriceId },
    data: { cost_price: unitCost, avg_cost: Math.round(avg * 100) / 100 },
  });
}

/** Moves the selling price and records why, so the change is never silent. */
async function applySellingPrice(
  tx: Tx,
  variantUnitPriceId: bigint,
  sellingPrice: number,
  adminId: bigint | null
) {
  const current = await tx.variantUnitPrice.findUnique({
    where: { id: variantUnitPriceId },
    select: { base_price: true },
  });
  if (!current) return;
  const oldPrice = Number(current.base_price);
  if (oldPrice === sellingPrice) return;

  await tx.variantUnitPrice.update({
    where: { id: variantUnitPriceId },
    data: { base_price: sellingPrice, updated_by: adminId },
  });
  await tx.variant_price_history.create({
    data: {
      uuid: crypto.randomUUID(),
      variant_unit_price_id: variantUnitPriceId,
      old_base_price: oldPrice,
      new_base_price: sellingPrice,
      created_by: adminId,
      updated_by: adminId,
    },
  });
}

/**
 * Writes a goods receipt for one delivery: raises stock for the units accepted
 * (PURCHASE movement), records any that were refused, and rolls the delivery's
 * cost and new selling price into the SKU.
 *
 * Returns the refused lines so the caller can raise the debit note; this
 * function deliberately does not, because only the caller knows the vendor.
 */
export async function postReceipt(
  tx: Tx,
  po: { id: bigint; po_number: string; invoice_number: string | null },
  lines: ReceiptLine[],
  notes: string | null | undefined,
  adminId: bigint | null
): Promise<{ receiptId: bigint; damaged: DamagedLine[] }> {
  const receipt = await tx.purchase_receipts.create({
    data: {
      purchase_order_id: po.id,
      receipt_number: `TMP-${crypto.randomUUID().slice(0, 8)}`,
      notes,
      received_by: adminId,
    },
  });
  await tx.purchase_receipts.update({
    where: { id: receipt.id },
    data: { receipt_number: `GRN-${String(receipt.id).padStart(6, "0")}` },
  });

  const damaged: DamagedLine[] = [];

  for (const line of lines) {
    const { item, quantity } = line;
    const damagedQuantity = line.damagedQuantity ?? 0;

    const receiptItem = await tx.purchase_receipt_items.create({
      data: {
        receipt_id: receipt.id,
        purchase_order_item_id: item.id,
        variant_unit_price_id: item.variant_unit_price_id,
        quantity_received: quantity,
        quantity_rejected: damagedQuantity,
        rejection_reason: damagedQuantity > 0 ? (line.remarks?.slice(0, 255) ?? "Damaged on arrival") : null,
        unit_cost: item.unit_cost,
      },
      select: { id: true },
    });
    await tx.purchase_order_items.update({
      where: { id: item.id },
      data: { quantity_received: { increment: quantity } },
    });

    // Everything in this delivery can be damaged, and then nothing enters stock.
    if (quantity > 0) {
      const movement = await recordStockMovement(tx, {
        variantUnitPriceId: item.variant_unit_price_id,
        movementType: "PURCHASE",
        direction: "in",
        quantity,
        referenceType: "purchase_receipt",
        referenceId: receipt.id,
        referenceNumber: po.po_number,
        reason: `Purchase ${po.po_number}${po.invoice_number ? ` (Invoice ${po.invoice_number})` : ""}`,
        actorId: adminId,
      });
      await applyCost(tx, item.variant_unit_price_id, Number(item.unit_cost), quantity, movement.previousStock);
    }

    if (line.sellingPrice !== null && line.sellingPrice !== undefined) {
      await applySellingPrice(tx, item.variant_unit_price_id, line.sellingPrice, adminId);
    }

    if (damagedQuantity > 0) {
      damaged.push({
        purchaseOrderItemId: item.id,
        purchaseReceiptItemId: receiptItem.id,
        variantUnitPriceId: item.variant_unit_price_id,
        quantity: damagedQuantity,
        unitCost: item.unit_cost,
        notes: line.remarks ?? null,
      });
    }
  }

  return { receiptId: receipt.id, damaged };
}

const TRANSITIONS: Record<
  PurchaseActionInput["action"],
  { from: PurchaseStatus[]; to: PurchaseStatus }
> = {
  submit: { from: ["DRAFT", "REJECTED"], to: "PENDING_APPROVAL" },
  approve: { from: ["PENDING_APPROVAL"], to: "APPROVED" },
  reject: { from: ["PENDING_APPROVAL"], to: "REJECTED" },
  order: { from: ["APPROVED"], to: "ORDERED" },
  cancel: {
    from: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ORDERED"],
    to: "CANCELLED",
  },
};

export const purchaseService = {
  async list(params: GetPurchasesParams) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const where: Prisma.purchase_ordersWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.vendorId ? { vendor: { uuid: params.vendorId } } : {}),
      ...(params.search
        ? {
            OR: [
              { po_number: { contains: params.search } },
              { invoice_number: { contains: params.search } },
              { vendor: { name: { contains: params.search } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db.purchase_orders.findMany({
        where,
        include: listInclude,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.purchase_orders.count({ where }),
    ]);
    return {
      data: rows.map(format),
      meta: { page, limit: pageSize, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  get: loadDetail,

  async create(input: PurchaseOrderInput, adminEmail?: string | null) {
    const vendor = await resolveVendor(input.vendorId);
    const items = await buildItems(input.items);
    const adminId = await getAdminInternalId(adminEmail);
    const uuid = crypto.randomUUID();

    await db.$transaction(async (tx) => {
      const po = await tx.purchase_orders.create({
        data: {
          uuid,
          po_number: `TMP-${uuid.slice(0, 8)}`,
          vendor_id: vendor.id,
          ...headerData(input, items),
          created_by: adminId,
          updated_by: adminId,
          items: { create: items },
        },
      });
      await tx.purchase_orders.update({
        where: { id: po.id },
        data: { po_number: `PO-${String(po.id).padStart(6, "0")}` },
      });
      await tx.purchase_order_history.create({
        data: { purchase_order_id: po.id, to_status: "DRAFT", note: "Created", changed_by: adminId },
      });
    });
    return loadDetail(uuid);
  },

  async update(uuid: string, input: PurchaseOrderInput, adminEmail?: string | null) {
    const po = await findByUuid(uuid);
    if (po.status !== "DRAFT" && po.status !== "REJECTED") {
      throw ApiError.badRequest("Only draft or rejected purchase orders can be edited");
    }
    const vendor = await resolveVendor(input.vendorId);
    const items = await buildItems(input.items);
    const adminId = await getAdminInternalId(adminEmail);

    await db.$transaction(async (tx) => {
      await tx.purchase_order_items.deleteMany({ where: { purchase_order_id: po.id } });
      await tx.purchase_orders.update({
        where: { id: po.id },
        data: {
          vendor_id: vendor.id,
          ...headerData(input, items),
          updated_by: adminId,
          items: { create: items },
        },
      });
    });
    return loadDetail(uuid);
  },

  async act(uuid: string, input: PurchaseActionInput, adminEmail?: string | null) {
    const rule = TRANSITIONS[input.action];
    const adminId = await getAdminInternalId(adminEmail);

    if (input.action === "reject" && !input.reason) {
      throw ApiError.badRequest("A reason is required to reject a purchase order");
    }

    await db.$transaction(async (tx) => {
      const po = await tx.purchase_orders.findUnique({ where: { uuid } });
      if (!po) throw ApiError.notFound("Purchase order not found");
      if (!rule.from.includes(po.status as PurchaseStatus)) {
        throw ApiError.badRequest(`Cannot ${input.action} a purchase order that is ${po.status}`);
      }
      const now = new Date();
      // The status guard in the WHERE makes concurrent clicks safe: only one wins.
      const res = await tx.purchase_orders.updateMany({
        where: { id: po.id, status: po.status },
        data: {
          status: rule.to,
          updated_by: adminId,
          ...(input.action === "submit" && { submitted_at: now, reject_reason: null }),
          ...(input.action === "approve" && { approved_by: adminId, approved_at: now }),
          ...(input.action === "reject" && { reject_reason: input.reason }),
          ...(input.action === "order" && { ordered_at: now }),
          ...(input.action === "cancel" && { cancelled_at: now }),
        },
      });
      if (res.count === 0) throw ApiError.conflict("Purchase order was changed by someone else");
      await tx.purchase_order_history.create({
        data: {
          purchase_order_id: po.id,
          from_status: po.status,
          to_status: rule.to,
          note: input.reason ?? null,
          changed_by: adminId,
        },
      });
    });
    return loadDetail(uuid);
  },

  async receive(uuid: string, input: ReceiveInput, adminEmail?: string | null) {
    const adminId = await getAdminInternalId(adminEmail);
    const lines = input.items.filter((i) => i.quantity > 0);
    if (lines.length === 0) throw ApiError.badRequest("Enter a quantity for at least one item");

    await db.$transaction(async (tx) => {
      const found = await tx.purchase_orders.findUnique({ where: { uuid } });
      if (!found) throw ApiError.notFound("Purchase order not found");
      // Lock the row so two people receiving at once cannot both pass the remaining-qty check.
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${found.id} FOR UPDATE`;
      const po = await tx.purchase_orders.findUniqueOrThrow({
        where: { id: found.id },
        include: { items: true },
      });
      if (po.status !== "ORDERED" && po.status !== "PARTIALLY_RECEIVED") {
        throw ApiError.badRequest("Goods can only be received on an ordered purchase order");
      }

      const byId = new Map(po.items.map((i) => [Number(i.id), i]));
      for (const line of lines) {
        const item = byId.get(line.itemId);
        if (!item) throw ApiError.badRequest("Item does not belong to this purchase order");
        const remaining = item.quantity_ordered - item.quantity_received;
        if (line.quantity > remaining) {
          throw ApiError.badRequest(`Cannot receive ${line.quantity}; only ${remaining} remaining`);
        }
      }

      await postReceipt(
        tx,
        po,
        lines.map((l) => ({ item: byId.get(l.itemId)!, quantity: l.quantity })),
        input.notes,
        adminId
      );

      const fresh = await tx.purchase_order_items.findMany({ where: { purchase_order_id: po.id } });
      const complete = fresh.every((i) => i.quantity_received >= i.quantity_ordered);
      const next: PurchaseStatus = complete ? "RECEIVED" : "PARTIALLY_RECEIVED";
      await tx.purchase_orders.update({
        where: { id: po.id },
        data: { status: next, updated_by: adminId, ...(complete && { received_at: new Date() }) },
      });
      await tx.purchase_order_history.create({
        data: {
          purchase_order_id: po.id,
          from_status: po.status,
          to_status: next,
          note: `Received ${lines.reduce((s, l) => s + l.quantity, 0)} unit(s)`,
          changed_by: adminId,
        },
      });
    });
    return loadDetail(uuid);
  },

  /**
   * One-step purchase entry: saves the purchase, its items and a receipt, and
   * raises stock immediately. Re-submitting the same idempotency key returns
   * the original purchase without touching stock again.
   */
  async confirm(input: ConfirmPurchaseInput, adminEmail?: string | null) {
    const existing = await db.purchase_orders.findUnique({
      where: { idempotency_key: input.idempotencyKey },
      select: { uuid: true },
    });
    if (existing) return loadDetail(existing.uuid);

    const vendor = await resolveVendor(input.vendorId);
    const items = await buildItems(input.items);
    const adminId = await getAdminInternalId(adminEmail);
    const uuid = crypto.randomUUID();
    const now = new Date();

    // What the stock sheet adds per line, looked up again once the order items
    // have ids. Damaged units are billed but never stocked.
    const extras = new Map(
      input.items.map((i) => [
        i.variantUnitPriceId,
        {
          damagedQuantity: Math.min(i.damagedQuantity, i.quantity),
          sellingPrice: i.sellingPrice,
          remarks: i.remarks,
        },
      ])
    );

    try {
      await db.$transaction(async (tx) => {
        const po = await tx.purchase_orders.create({
          data: {
            uuid,
            po_number: `TMP-${uuid.slice(0, 8)}`,
            vendor_id: vendor.id,
            status: "RECEIVED",
            idempotency_key: input.idempotencyKey,
            ...headerData(input, items),
            submitted_at: now,
            approved_by: adminId,
            approved_at: now,
            ordered_at: now,
            received_at: now,
            created_by: adminId,
            updated_by: adminId,
            items: { create: items },
          },
          include: { items: true },
        });
        const poNumber = `PO-${String(po.id).padStart(6, "0")}`;
        await tx.purchase_orders.update({ where: { id: po.id }, data: { po_number: poNumber } });
        const { damaged } = await postReceipt(
          tx,
          { id: po.id, po_number: poNumber, invoice_number: po.invoice_number },
          po.items.map((item) => {
            const extra = extras.get(Number(item.variant_unit_price_id));
            const damagedQuantity = extra?.damagedQuantity ?? 0;
            return {
              item,
              quantity: item.quantity_ordered - damagedQuantity,
              damagedQuantity,
              sellingPrice: extra?.sellingPrice ?? null,
              remarks: extra?.remarks ?? null,
            };
          }),
          input.notes,
          adminId
        );

        const returned = await createRejectionReturn(
          tx,
          { id: po.id, vendor_id: vendor.id, po_number: poNumber, invoice_number: po.invoice_number },
          damaged,
          adminId
        );

        const stocked = po.items.reduce(
          (n, i) => n + i.quantity_ordered - (extras.get(Number(i.variant_unit_price_id))?.damagedQuantity ?? 0),
          0
        );
        await tx.purchase_order_history.create({
          data: {
            purchase_order_id: po.id,
            to_status: "RECEIVED",
            note: `Purchase confirmed; ${stocked} unit(s) added to stock${returned ? `, damaged units drafted as ${returned.returnNumber}` : ""}`,
            changed_by: adminId,
          },
        });
      });
    } catch (e) {
      // A concurrent submit with the same key lost the race; its transaction (and stock) rolled back.
      if ((e as { code?: string }).code === "P2002") {
        const winner = await db.purchase_orders.findUnique({
          where: { idempotency_key: input.idempotencyKey },
          select: { uuid: true },
        });
        if (winner) return loadDetail(winner.uuid);
      }
      throw e;
    }
    return loadDetail(uuid);
  },

  async searchProducts(search?: string): Promise<PurchaseProductOption[]> {
    const rows = await db.variantUnitPrice.findMany({
      where: {
        isActive: true,
        deleted_at: null,
        variant: { isActive: true, deleted_at: null },
        ...(search
          ? {
              OR: [
                { sku: { contains: search } },
                { variant: { item: { name: { contains: search } } } },
                { variant: { item: { style: { product: { name: { contains: search } } } } } },
              ],
            }
          : {}),
      },
      include: {
        inventories: { select: { quantity_available: true, reorderLevel: true } },
        product_units: { select: { name: true } },
        ...productSelect,
      },
      orderBy: { id: "desc" },
      take: 25,
    });
    return rows.map((r) => ({
      variantUnitPriceId: Number(r.id),
      label: [
        productName(r),
        r.variant?.variant_name,
        r.variant?.color_name,
        r.attribute_value?.value ?? r.product_units?.name,
      ]
        .filter(Boolean)
        .join(" · "),
      productName: productName(r),
      colorName: r.variant?.color_name ?? null,
      sizeName: r.attribute_value?.value ?? null,
      sku: r.sku,
      stock: r.inventories?.quantity_available ?? 0,
      reorderLevel: r.inventories?.reorderLevel ?? 0,
    }));
  },
};
