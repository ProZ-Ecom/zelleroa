import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma";
import { recordStockMovement } from "@/features/inventory/services/stock-ledger.service";
import { nextInvoiceNumber } from "../services/pos-invoice-number.service";
import { POS_METHOD_CODES } from "../services/pos-session.service";
import type { PosPaymentMode } from "../types";

type Tx = Prisma.TransactionClient;

/** A priced, stock-checked line, ready to be written. */
export interface PosBillLine {
  productId: bigint;
  styleId: bigint;
  itemId: bigint | null;
  variantId: bigint;
  variantUnitPriceId: bigint;
  productName: string;
  itemName: string;
  variantName: string;
  attributes: Array<{ name: string; value: string }>;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  totalPrice: number;
}

export interface CreatePosBillParams {
  storeId: bigint;
  storePrefix: string;
  sessionId: bigint;
  cashierId: bigint;
  /** The registered buyer when their phone matched an account, else the cashier. */
  buyerUserId: bigint;
  manualCustomer: { name: string; phone: string } | null;
  /** Place of supply, copied onto the bill so the invoice renders CGST + SGST. */
  billingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  };
  lines: PosBillLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMode: PosPaymentMode;
  paymentReference: string | null;
  note: string | null;
}

const PAYMENT_METHOD_NAMES: Record<PosPaymentMode, string> = {
  CASH: "Counter cash",
  UPI: "Counter UPI",
  CARD: "Counter card",
};

/**
 * The payment method row for a tender, created on first use.
 *
 * Upsert rather than find-then-create: `code` is unique, so two cashiers taking
 * the shop's first-ever UPI payment at the same moment would otherwise collide
 * on P2002.
 */
async function resolvePaymentMethod(tx: Tx, mode: PosPaymentMode, actorId: bigint) {
  const code = POS_METHOD_CODES[mode];
  return tx.payment_methods.upsert({
    where: { code },
    update: {},
    create: {
      name: PAYMENT_METHOD_NAMES[mode],
      code,
      is_active: true,
      created_by: actorId,
      updated_by: actorId,
    },
  });
}

async function generateOrderNumber(tx: Tx): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 10; attempt++) {
    const orderNumber = `POS-${dateStr}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const clash = await tx.order.findUnique({ where: { orderNumber }, select: { id: true } });
    if (!clash) return orderNumber;
  }
  return `POS-${dateStr}-${Date.now().toString().slice(-6)}`;
}

export const posRepository = {
  /**
   * One counter sale, written in a single transaction.
   *
   * Everything a bill implies happens here or not at all: the number is
   * reserved off the locked counter, the order and its lines are written, stock
   * leaves through the ledger, and the payment is recorded as already taken.
   * If any step fails - most likely the stock check - the bill does not exist,
   * which is the only safe outcome when the customer is standing there.
   *
   * Differences from an online order are deliberate, not oversights:
   * no cart to claim, no stock reservation to confirm (the goods leave with the
   * customer now), no commission (counter sales carry none), and the status
   * goes straight to delivered and paid.
   */
  async createBill(params: CreatePosBillParams) {
    return db.$transaction(async (tx) => {
      const now = new Date();

      // Reserving the number first means a bill that fails later burns one.
      // That is the right trade: a GST series may not reuse a number, and a
      // gap with no order behind it is explainable where a duplicate is not.
      const invoiceNumber = await nextInvoiceNumber(tx, {
        storeId: params.storeId,
        prefix: params.storePrefix,
        at: now,
      });
      const orderNumber = await generateOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          uuid: crypto.randomUUID(),
          orderNumber,
          invoice_number: invoiceNumber,
          userId: params.buyerUserId,
          store_id: params.storeId,
          pos_session_id: params.sessionId,
          order_source: "POS",
          ordered_by_id: params.cashierId,
          is_manual_customer: Boolean(params.manualCustomer),
          manual_customer_name: params.manualCustomer?.name ?? null,
          manual_customer_phone: params.manualCustomer?.phone ?? null,
          // Counter sales carry no commission, so no agent and no referral code.
          agent_id: null,
          referral_code: null,
          cart_id: null,
          delivery_slot_id: null,
          order_status: "delivered",
          payment_status: "paid",
          subtotal: params.subtotal,
          discountAmount: params.discountAmount,
          taxAmount: params.taxAmount,
          shipping_charge: 0,
          totalAmount: params.totalAmount,
          notes: params.note,
          placed_at: now,
          delivered_at: now,
          is_active: true,
          created_by: params.cashierId,
          updated_by: params.cashierId,
        },
      });

      // The invoice renderer reads the billing address to decide CGST + SGST
      // against IGST. A walk-in has no address, so the counter's own city and
      // state stand in as the place of supply - which is what they are.
      await tx.orderAddress.create({
        data: {
          uuid: crypto.randomUUID(),
          orderId: order.id,
          type: "billing",
          full_name: params.billingAddress.fullName,
          phone: params.billingAddress.phone,
          address_line1: params.billingAddress.addressLine1,
          city: params.billingAddress.city,
          state: params.billingAddress.state,
          pincode: params.billingAddress.pincode,
          country: "India",
          is_active: true,
          created_by: params.cashierId,
          updated_by: params.cashierId,
        },
      });

      const costRows = await tx.variantUnitPrice.findMany({
        where: { id: { in: params.lines.map((l) => l.variantUnitPriceId) } },
        select: { id: true, avg_cost: true, cost_price: true },
      });
      const costBySku = new Map(
        costRows.map((r) => [String(r.id), r.avg_cost ?? r.cost_price ?? null])
      );

      await tx.orderItem.createMany({
        data: params.lines.map((line) => ({
          uuid: crypto.randomUUID(),
          orderId: order.id,
          productId: line.productId,
          styleId: line.styleId,
          itemId: line.itemId,
          variantId: line.variantId,
          variantUnitPriceId: line.variantUnitPriceId,
          product_name_snapshot: line.productName,
          item_name_snapshot: line.itemName,
          variant_snapshot: line.variantName,
          attributes_snapshot: line.attributes,
          sku_snapshot: line.sku,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          unit_cost: costBySku.get(String(line.variantUnitPriceId)) ?? null,
          discount_amount: line.discountAmount,
          tax_amount: line.taxAmount,
          total_price: line.totalPrice,
          is_active: true,
          created_by: params.cashierId,
          updated_by: params.cashierId,
        })),
      });

      // `recordStockMovement` locks each stock row with SELECT ... FOR UPDATE
      // and refuses to go below zero, so two cashiers selling the last piece of
      // the same SKU queue up and the second one's whole bill rolls back with
      // "Insufficient stock" - the correct answer, before the money is taken.
      for (const line of params.lines) {
        await recordStockMovement(tx, {
          variantUnitPriceId: line.variantUnitPriceId,
          movementType: "SALE",
          direction: "out",
          quantity: line.quantity,
          referenceType: "pos_order",
          referenceId: order.id,
          referenceNumber: orderNumber,
          reason: `Counter sale ${invoiceNumber}`,
          actorId: params.cashierId,
          itemLabel: `${line.variantName} (SKU: ${line.sku})`,
        });
      }

      const method = await resolvePaymentMethod(tx, params.paymentMode, params.cashierId);
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          payment_method_id: method.id,
          amount: params.totalAmount,
          currency: "INR",
          // The money is in the drawer before this row exists; there is no
          // gateway to confirm anything later.
          status: "success",
          gateway: null,
          gateway_payment_id: params.paymentReference,
          is_active: true,
          created_by: params.cashierId,
          updated_by: params.cashierId,
        },
      });

      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          transaction_type: "charge",
          amount: params.totalAmount,
          status: "captured",
          gatewayResponse: {
            source: "POS",
            mode: params.paymentMode,
            reference: params.paymentReference,
            sessionId: params.sessionId.toString(),
            collectedBy: params.cashierId.toString(),
            recordedAt: now.toISOString(),
          } as Prisma.InputJsonValue,
          created_by: params.cashierId,
          updated_by: params.cashierId,
        },
      });

      await tx.order_status_history.create({
        data: {
          order_id: order.id,
          status: "delivered",
          note: `Counter sale ${invoiceNumber} paid by ${params.paymentMode}`,
          changed_by: params.cashierId,
          is_active: true,
          created_by: params.cashierId,
          updated_by: params.cashierId,
        },
      });

      return { orderId: order.id, orderUuid: order.uuid!, orderNumber, invoiceNumber, at: now };
    });
  },

  /**
   * Void a counter bill: stock back in, payment reversed, order cancelled.
   *
   * The bill number is kept and the order stays in place marked cancelled. A
   * GST series may not have holes, so a wrong bill is reversed, never deleted.
   */
  async voidBill(params: { orderUuid: string; actorId: bigint; reason: string }) {
    return db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { uuid: params.orderUuid, order_source: "POS" },
        select: {
          id: true,
          orderNumber: true,
          invoice_number: true,
          order_status: true,
          totalAmount: true,
          items: {
            where: { is_active: true },
            select: {
              variantUnitPriceId: true,
              quantity: true,
              sku_snapshot: true,
              variant_snapshot: true,
            },
          },
        },
      });
      if (!order) throw ApiError.notFound("Counter bill not found");

      // Conditional update is the lock: two managers voiding the same bill both
      // read it live, only one flips it, so stock cannot go back twice.
      const claimed = await tx.order.updateMany({
        where: { id: order.id, order_status: { not: "cancelled" } },
        data: {
          order_status: "cancelled",
          payment_status: "refunded",
          cancelled_at: new Date(),
          cancelled_by: "ADMIN",
          cancelled_by_user_id: params.actorId,
          cancellation_reason: "Counter void",
          cancellation_comment: params.reason,
          updated_by: params.actorId,
        },
      });
      if (claimed.count !== 1) throw ApiError.conflict("This bill is already voided");

      for (const item of order.items) {
        if (!item.variantUnitPriceId) continue;
        await recordStockMovement(tx, {
          variantUnitPriceId: item.variantUnitPriceId,
          movementType: "RETURN",
          direction: "in",
          quantity: item.quantity,
          referenceType: "pos_void",
          referenceId: order.id,
          referenceNumber: order.orderNumber,
          reason: `Void ${order.invoice_number ?? order.orderNumber}: ${params.reason}`,
          actorId: params.actorId,
          itemLabel: `${item.variant_snapshot} (SKU: ${item.sku_snapshot})`,
        });
      }

      await tx.payment.updateMany({
        where: { orderId: order.id, is_active: true },
        data: { status: "refunded", updated_by: params.actorId },
      });

      await tx.order_status_history.create({
        data: {
          order_id: order.id,
          status: "cancelled",
          note: `Counter bill voided: ${params.reason}`,
          changed_by: params.actorId,
          is_active: true,
          created_by: params.actorId,
          updated_by: params.actorId,
        },
      });

      return {
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoice_number,
        amount: Number(order.totalAmount),
      };
    });
  },
};
