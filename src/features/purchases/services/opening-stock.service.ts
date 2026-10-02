import crypto from "crypto";
import type { Prisma } from "@/generated/prisma";
import { postReceipt } from "./purchase.service";

type Tx = Prisma.TransactionClient;

const OPENING_VENDOR_CODE = "OPENING-STOCK";

async function openingStockVendorId(tx: Tx): Promise<bigint> {
  const existing = await tx.vendors.findFirst({
    where: { code: OPENING_VENDOR_CODE, deleted_at: null },
    select: { id: true, is_active: true },
  });
  if (existing) {
    if (!existing.is_active) {
      await tx.vendors.update({ where: { id: existing.id }, data: { is_active: true } });
    }
    return existing.id;
  }
  const created = await tx.vendors.create({
    data: {
      uuid: crypto.randomUUID(),
      code: OPENING_VENDOR_CODE,
      name: "Opening Stock",
      notes: "System vendor for stock entered while creating items",
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Stock typed in while creating items has no vendor or invoice, but it must
 * still show up as purchase data. Records it as one RECEIVED purchase order
 * (with a goods receipt and PURCHASE ledger movements) under the system
 * "Opening Stock" vendor, in the caller's transaction. Cost is 0 because none
 * is known at item creation. No-op when there is nothing to receive.
 */
export async function recordOpeningStockPurchase(
  tx: Tx,
  lines: { variantUnitPriceId: bigint; quantity: number }[],
  adminId: bigint | null,
  note: string
): Promise<void> {
  const stocked = lines.filter((l) => l.quantity > 0);
  if (stocked.length === 0) return;

  const vendorId = await openingStockVendorId(tx);
  const uuid = crypto.randomUUID();
  const now = new Date();
  const po = await tx.purchase_orders.create({
    data: {
      uuid,
      po_number: `TMP-${uuid.slice(0, 8)}`,
      vendor_id: vendorId,
      status: "RECEIVED",
      purchase_date: now,
      notes: note.slice(0, 500),
      submitted_at: now,
      approved_by: adminId,
      approved_at: now,
      ordered_at: now,
      received_at: now,
      created_by: adminId,
      updated_by: adminId,
      items: {
        create: stocked.map((l) => ({
          variant_unit_price_id: l.variantUnitPriceId,
          quantity_ordered: l.quantity,
          unit_cost: 0,
        })),
      },
    },
    include: { items: true },
  });
  const poNumber = `PO-${String(po.id).padStart(6, "0")}`;
  await tx.purchase_orders.update({ where: { id: po.id }, data: { po_number: poNumber } });

  const quantityByVup = new Map(stocked.map((l) => [l.variantUnitPriceId, l.quantity]));
  await postReceipt(
    tx,
    { id: po.id, po_number: poNumber, invoice_number: null },
    po.items.map((item) => ({ item, quantity: quantityByVup.get(item.variant_unit_price_id)! })),
    note,
    adminId
  );
  await tx.purchase_order_history.create({
    data: {
      purchase_order_id: po.id,
      to_status: "RECEIVED",
      note,
      changed_by: adminId,
    },
  });
}
