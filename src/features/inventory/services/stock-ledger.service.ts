import { ApiError } from "@/lib/api/api-error";
import type { Prisma, stock_movement_type } from "@/generated/prisma";

type Tx = Prisma.TransactionClient;

export type StockMovementType = stock_movement_type;
export type StockDirection = "in" | "out";

export interface StockMovementInput {
  variantUnitPriceId: bigint;
  movementType: StockMovementType;
  direction: StockDirection;
  /** Always positive; the direction decides the sign. */
  quantity: number;
  /** Machine reference, e.g. "order", "purchase_receipt", "return_request". */
  referenceType?: string | null;
  referenceId?: bigint | null;
  /** Display reference, e.g. PO-000012 or an order number. */
  referenceNumber?: string | null;
  reason?: string | null;
  actorId?: bigint | null;
  /** Label used in the insufficient-stock error message. */
  itemLabel?: string;
}

export interface StockMovementResult {
  previousStock: number;
  newStock: number;
  transactionId: bigint;
}

/**
 * The only place that is allowed to change `inventories.quantity_available`.
 *
 * Locks the stock row, refuses to go below zero, updates the level and writes
 * the ledger row (type, before/after level, reference, reason, actor) in the
 * caller's transaction - so a stock change and its audit record commit or roll
 * back together.
 */
export async function recordStockMovement(
  tx: Tx,
  input: StockMovementInput
): Promise<StockMovementResult> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw ApiError.badRequest("Stock quantity must be a positive whole number");
  }

  // Stock arriving for an item that has never had a stock row creates it at 0.
  if (input.direction === "in") {
    await tx.inventory.upsert({
      where: { variantUnitPriceId: input.variantUnitPriceId },
      create: {
        variantUnitPriceId: input.variantUnitPriceId,
        quantity_available: 0,
        created_by: input.actorId ?? null,
      },
      update: {},
    });
  }

  const rows = await tx.$queryRaw<{ quantity_available: number }[]>`
    SELECT quantity_available FROM inventories
    WHERE variant_unit_price_id = ${input.variantUnitPriceId} FOR UPDATE`;
  const previousStock = rows.length > 0 ? Number(rows[0].quantity_available) : 0;
  const signed = input.direction === "in" ? input.quantity : -input.quantity;
  const newStock = previousStock + signed;

  if (newStock < 0) {
    throw ApiError.badRequest(
      `Insufficient stock${input.itemLabel ? ` for "${input.itemLabel}"` : ""}. Available: ${previousStock}, required: ${input.quantity}`
    );
  }

  await tx.inventory.update({
    where: { variantUnitPriceId: input.variantUnitPriceId },
    data: { quantity_available: newStock, updated_by: input.actorId ?? null },
  });

  // Keep the colour's out_of_stock flag in step with its total stock, so the
  // storefront and admin badges agree with the stock counts.
  await tx.$executeRaw`
    UPDATE product_variants pv
    SET pv.out_of_stock = (
      SELECT COALESCE(SUM(i.quantity_available), 0) FROM variant_unit_prices vup
      JOIN inventories i ON i.variant_unit_price_id = vup.id
      WHERE vup.variant_id = pv.id AND vup.deleted_at IS NULL
    ) <= 0
    WHERE pv.id = (SELECT variant_id FROM variant_unit_prices WHERE id = ${input.variantUnitPriceId})`;

  const txn = await tx.inventoryTransaction.create({
    data: {
      variant_unit_price_id: input.variantUnitPriceId,
      type: input.direction,
      movement_type: input.movementType,
      quantity: input.quantity,
      previous_stock: previousStock,
      new_stock: newStock,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      reference_number: input.referenceNumber?.slice(0, 60) ?? null,
      note: input.reason?.slice(0, 255) ?? null,
      created_by: input.actorId ?? null,
      updated_by: input.actorId ?? null,
    },
    select: { id: true },
  });

  return { previousStock, newStock, transactionId: txn.id };
}

/**
 * Sets stock to an absolute level (admin forms that edit "stock" directly) by
 * recording the difference as an ADJUSTMENT. No-op when nothing changed.
 */
export async function setStockLevel(
  tx: Tx,
  params: {
    variantUnitPriceId: bigint;
    target: number;
    reason: string;
    actorId?: bigint | null;
  }
): Promise<StockMovementResult | null> {
  await tx.inventory.upsert({
    where: { variantUnitPriceId: params.variantUnitPriceId },
    create: {
      variantUnitPriceId: params.variantUnitPriceId,
      quantity_available: 0,
      created_by: params.actorId ?? null,
    },
    update: {},
  });
  const rows = await tx.$queryRaw<{ quantity_available: number }[]>`
    SELECT quantity_available FROM inventories
    WHERE variant_unit_price_id = ${params.variantUnitPriceId} FOR UPDATE`;
  const current = Number(rows[0]?.quantity_available ?? 0);
  const delta = params.target - current;
  if (delta === 0) return null;
  return recordStockMovement(tx, {
    variantUnitPriceId: params.variantUnitPriceId,
    movementType: "ADJUSTMENT",
    direction: delta > 0 ? "in" : "out",
    quantity: Math.abs(delta),
    reason: params.reason,
    actorId: params.actorId,
  });
}
