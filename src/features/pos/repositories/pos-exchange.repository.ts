import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { recordStockMovement } from "@/features/inventory/services/stock-ledger.service";
import { nextInvoiceNumber } from "../services/pos-invoice-number.service";
import { POS_METHOD_CODES } from "../services/pos-session.service";
import type {
  PosBillLineDto,
  PosExchangeBillLookupDto,
  PosExchangeEligibleItem,
  PosExchangeReceiptDto,
  PosExchangeReturnLineDto,
  PosItemCondition,
  PosPaymentMode,
  PosStoreDto,
} from "../types";

type Tx = Prisma.TransactionClient;

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

const PAYMENT_METHOD_NAMES: Record<PosPaymentMode, string> = {
  CASH: "Counter Cash",
  UPI: "Counter UPI",
  CARD: "Counter Card",
};

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

async function generateExchangeOrderNumber(tx: Tx): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 10; attempt++) {
    const orderNumber = `EXC-${dateStr}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const clash = await tx.order.findUnique({ where: { orderNumber }, select: { id: true } });
    if (!clash) return orderNumber;
  }
  return `EXC-${dateStr}-${Date.now().toString().slice(-6)}`;
}

export interface ReturnItemExecutionParam {
  orderItemId: bigint;
  variantUnitPriceId: bigint;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number; // Effective unit price paid on original bill
  totalPrice: number;
  condition: PosItemCondition;
  reason: string;
  reasonDetail?: string | null;
}

export interface NewItemExecutionParam {
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
  isDefectiveReplacement?: boolean;
}

export interface ExecuteExchangeParams {
  storeId: bigint;
  storePrefix: string;
  store: PosStoreDto;
  sessionId: bigint;
  cashierId: bigint;
  cashierName: string;
  approvingManagerId?: bigint | null;
  approvingManagerName?: string | null;
  buyerUserId: bigint;
  originalOrderId: bigint;
  customerName?: string | null;
  customerPhone?: string | null;
  returnItems: ReturnItemExecutionParam[];
  newItems: NewItemExecutionParam[];
  totalReturnedValue: number;
  totalNewValue: number;
  netPayable: number;
  paymentMode?: PosPaymentMode | null;
  cashReceived?: number | null;
  paymentReference?: string | null;
  notes?: string | null;
  primaryReason: string;
  billingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  };
}

export const posExchangeRepository = {
  /**
   * Searches original counter bills by invoice number, order number, or customer phone.
   * Restricts search to the specified store.
   */
  async findBillsForExchange(query: string, storeId: bigint): Promise<PosExchangeBillLookupDto[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const isPhone = /^\d{10}$/.test(cleanQuery);

    const orders = await db.order.findMany({
      where: {
        store_id: storeId,
        order_source: "POS",
        order_status: { not: "cancelled" },
        OR: isPhone
          ? [{ manual_customer_phone: cleanQuery }, { user: { phone: cleanQuery } }]
          : [
              { invoice_number: cleanQuery },
              { orderNumber: cleanQuery },
              { manual_customer_phone: cleanQuery },
              { user: { phone: cleanQuery } },
            ],
      },
      include: {
        store: { select: { id: true, name: true } },
        user: { select: { name: true, phone: true } },
        payments: {
          where: { is_active: true, status: "success" },
          select: { payment_methods: { select: { name: true, code: true } } },
          take: 1,
        },
        items: {
          where: { is_active: true },
          select: {
            id: true,
            orderId: true,
            variantUnitPriceId: true,
            sku_snapshot: true,
            product_name_snapshot: true,
            variant_snapshot: true,
            attributes_snapshot: true,
            quantity: true,
            unit_price: true,
            discount_amount: true,
            tax_amount: true,
            total_price: true,
          },
        },
      },
      orderBy: { placed_at: "desc" },
      take: isPhone ? 10 : 5,
    });

    if (orders.length === 0) return [];

    const allItemIds = orders.flatMap((o) => o.items.map((i) => i.id));

    // Aggregate previously returned/exchanged quantities for each item
    const priorExchanges = await db.pos_exchange_return_items.groupBy({
      by: ["order_item_id"],
      where: { order_item_id: { in: allItemIds } },
      _sum: { quantity: true },
    });

    const priorByItemId = new Map(
      priorExchanges.map((pe) => [String(pe.order_item_id), pe._sum.quantity ?? 0])
    );

    return orders.map((order) => {
      const paymentMode =
        order.payments[0]?.payment_methods?.code === POS_METHOD_CODES.UPI
          ? "UPI"
          : order.payments[0]?.payment_methods?.code === POS_METHOD_CODES.CARD
            ? "CARD"
            : "CASH";

      const items: PosExchangeEligibleItem[] = order.items.map((line) => {
        const lineQty = line.quantity;
        const lineTotalPaid = Number(line.total_price);
        const alreadyExchanged = priorByItemId.get(String(line.id)) ?? 0;
        const eligible = Math.max(0, lineQty - alreadyExchanged);
        const effectiveUnitPrice = lineQty > 0 ? round2(lineTotalPaid / lineQty) : 0;

        let attrs: Array<{ name: string; value: string }> = [];
        if (Array.isArray(line.attributes_snapshot)) {
          attrs = line.attributes_snapshot as Array<{ name: string; value: string }>;
        }

        return {
          orderItemId: Number(line.id),
          variantUnitPriceId: Number(line.variantUnitPriceId ?? 0),
          sku: line.sku_snapshot,
          productName: line.product_name_snapshot,
          variantName: line.variant_snapshot,
          attributes: attrs,
          purchasedQuantity: lineQty,
          alreadyExchangedQuantity: alreadyExchanged,
          eligibleQuantity: eligible,
          originalUnitPrice: Number(line.unit_price),
          discountAmount: Number(line.discount_amount),
          effectiveUnitPrice,
          totalPrice: lineTotalPaid,
        };
      });

      return {
        orderId: Number(order.id),
        orderUuid: order.uuid ?? String(order.id),
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoice_number,
        storeId: Number(order.store_id),
        storeName: order.store?.name ?? "Store",
        placedAt: order.placed_at?.toISOString() ?? order.createdAt.toISOString(),
        customerName: order.manual_customer_name ?? order.user?.name ?? null,
        customerPhone: order.manual_customer_phone ?? order.user?.phone ?? null,
        totalAmount: Number(order.totalAmount),
        paymentMode,
        items,
      };
    });
  },

  /**
   * Executes a complete, atomic exchange transaction.
   *
   * Locks the original order items, validates remaining eligibility, reserves an EXCH
   * sequential invoice number, registers inventory movements (inward return, optional
   * damage write-off, and outward replacement), creates the new Order and Payment (if net > 0),
   * and records pos_exchanges and pos_exchange_return_items.
   */
  async executeExchange(params: ExecuteExchangeParams): Promise<PosExchangeReceiptDto> {
    return db.$transaction(async (tx) => {
      const now = new Date();

      // 1. Lock and verify the original order
      const originalOrder = await tx.order.findUnique({
        where: { id: params.originalOrderId },
        include: {
          items: { select: { id: true, quantity: true, total_price: true, variantUnitPriceId: true } },
        },
      });

      if (!originalOrder) {
        throw ApiError.notFound("Original bill not found");
      }
      if (originalOrder.order_status === "cancelled") {
        throw ApiError.badRequest("Cannot exchange items from a voided or cancelled bill");
      }

      const origItemMap = new Map(originalOrder.items.map((i) => [String(i.id), i]));

      // 2. Lock original order items and verify eligible quantities
      const itemIdsToLock = params.returnItems.map((ri) => ri.orderItemId);
      const lockedRows = await tx.$queryRaw<{ id: bigint; quantity: number }[]>`
        SELECT id, quantity FROM order_items 
        WHERE id IN (${Prisma.join(itemIdsToLock)}) FOR UPDATE
      `;

      // Check cumulative returns against original quantity
      for (const retItem of params.returnItems) {
        const origRow = origItemMap.get(String(retItem.orderItemId));
        if (!origRow) {
          throw ApiError.badRequest(`Item with ID ${retItem.orderItemId} is not in the original bill`);
        }

        const priorAgg = await tx.pos_exchange_return_items.aggregate({
          where: { order_item_id: retItem.orderItemId },
          _sum: { quantity: true },
        });

        const alreadyReturned = priorAgg._sum.quantity ?? 0;
        const available = origRow.quantity - alreadyReturned;

        if (retItem.quantity > available) {
          throw ApiError.badRequest(
            `Cannot return ${retItem.quantity} unit(s) of "${retItem.sku}". Only ${available} eligible unit(s) remaining.`
          );
        }
      }

      // 3. Reserve gapless GST exchange invoice number
      const exchangeNumber = await nextInvoiceNumber(tx, {
        storeId: params.storeId,
        prefix: params.storePrefix,
        series: "EXCH",
        at: now,
      });

      const exchangeOrderNumber = await generateExchangeOrderNumber(tx);

      // 4. Create new Order for the replacement items (if any new items exist)
      let createdNewOrder: { id: bigint; uuid: string | null } | null = null;
      const receiptNewLines: PosBillLineDto[] = [];
      let totalTaxAmount = 0;
      let totalTaxableValue = 0;

      if (params.newItems.length > 0) {
        const costRows = await tx.variantUnitPrice.findMany({
          where: { id: { in: params.newItems.map((l) => l.variantUnitPriceId) } },
          select: { id: true, avg_cost: true, cost_price: true },
        });
        const costBySku = new Map(
          costRows.map((r) => [String(r.id), r.avg_cost ?? r.cost_price ?? null])
        );

        totalTaxAmount = round2(params.newItems.reduce((sum, item) => sum + item.taxAmount, 0));
        totalTaxableValue = round2(
          params.newItems.reduce((sum, item) => sum + (item.totalPrice - item.taxAmount), 0)
        );

        const newOrder = await tx.order.create({
          data: {
            uuid: crypto.randomUUID(),
            orderNumber: exchangeOrderNumber,
            invoice_number: exchangeNumber,
            userId: params.buyerUserId,
            store_id: params.storeId,
            pos_session_id: params.sessionId,
            order_source: "POS",
            ordered_by_id: params.cashierId,
            is_manual_customer: Boolean(params.customerPhone || params.customerName),
            manual_customer_name: params.customerName ?? null,
            manual_customer_phone: params.customerPhone ?? null,
            order_status: "delivered",
            payment_status: "paid",
            subtotal: params.totalNewValue,
            discountAmount: params.totalReturnedValue, // Exchange credit applied as discount
            taxAmount: totalTaxAmount,
            shipping_charge: 0,
            totalAmount: params.netPayable,
            notes: `Counter Exchange against ${originalOrder.invoice_number ?? originalOrder.orderNumber}: ${params.notes ?? ""}`.trim(),
            placed_at: now,
            delivered_at: now,
            is_active: true,
            created_by: params.cashierId,
            updated_by: params.cashierId,
          },
        });

        createdNewOrder = newOrder;

        // Billing address (counter address)
        await tx.orderAddress.create({
          data: {
            uuid: crypto.randomUUID(),
            orderId: newOrder.id,
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

        // Insert new order items
        await tx.orderItem.createMany({
          data: params.newItems.map((line) => ({
            uuid: crypto.randomUUID(),
            orderId: newOrder.id,
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

        for (const line of params.newItems) {
          receiptNewLines.push({
            sku: line.sku,
            description: `${line.productName} (${line.variantName})`,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            lineTotal: line.totalPrice,
          });
        }

        // If netPayable > 0, record payment for the difference
        if (params.netPayable > 0 && params.paymentMode) {
          const method = await resolvePaymentMethod(tx, params.paymentMode, params.cashierId);
          await tx.payment.create({
            data: {
              orderId: newOrder.id,
              payment_method_id: method.id,
              amount: params.netPayable,
              currency: "INR",
              status: "success",
              gateway: null,
              gateway_payment_id: params.paymentReference ?? null,
              is_active: true,
              created_by: params.cashierId,
              updated_by: params.cashierId,
            },
          });
        }
      }

      // 5. Create pos_exchanges parent record
      const exchange = await tx.pos_exchanges.create({
        data: {
          uuid: crypto.randomUUID(),
          exchange_number: exchangeNumber,
          original_order_id: params.originalOrderId,
          new_order_id: createdNewOrder?.id ?? null,
          store_id: params.storeId,
          pos_session_id: params.sessionId,
          cashier_id: params.cashierId,
          approving_manager_id: params.approvingManagerId ?? null,
          customer_name: params.customerName ?? null,
          customer_phone: params.customerPhone ?? null,
          total_returned_value: params.totalReturnedValue,
          total_new_value: params.totalNewValue,
          net_payable: params.netPayable,
          payment_mode: params.paymentMode ?? null,
          payment_reference: params.paymentReference ?? null,
          status: "completed",
          reason: params.primaryReason,
          notes: params.notes ?? null,
          created_by: params.cashierId,
          updated_by: params.cashierId,
        },
      });

      // 6. Create pos_exchange_return_items records
      await tx.pos_exchange_return_items.createMany({
        data: params.returnItems.map((item) => ({
          exchange_id: exchange.id,
          order_item_id: item.orderItemId,
          variant_unit_price_id: item.variantUnitPriceId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          condition: item.condition,
          reason: item.reason,
          reason_detail: item.reasonDetail ?? null,
        })),
      });

      // 7. Inventory movements for RETURNED items
      for (const item of params.returnItems) {
        // Step A: Stock IN (RETURN)
        await recordStockMovement(tx, {
          variantUnitPriceId: item.variantUnitPriceId,
          movementType: "RETURN",
          direction: "in",
          quantity: item.quantity,
          referenceType: "pos_exchange",
          referenceId: exchange.id,
          referenceNumber: exchangeNumber,
          reason: `Exchange return ${exchangeNumber}: ${item.reason} (${item.condition})`,
          actorId: params.cashierId,
          itemLabel: `${item.description} (SKU: ${item.sku})`,
        });

        // Step B: If DEFECTIVE, write off immediately to DAMAGE stock
        if (item.condition === "DEFECTIVE") {
          await recordStockMovement(tx, {
            variantUnitPriceId: item.variantUnitPriceId,
            movementType: "DAMAGE",
            direction: "out",
            quantity: item.quantity,
            referenceType: "pos_exchange",
            referenceId: exchange.id,
            referenceNumber: exchangeNumber,
            reason: `Defective item written off on exchange ${exchangeNumber}: ${item.reasonDetail || item.reason}`,
            actorId: params.cashierId,
            itemLabel: `${item.description} (SKU: ${item.sku})`,
          });
        }
      }

      // 8. Inventory movements for NEW replacement items
      for (const line of params.newItems) {
        await recordStockMovement(tx, {
          variantUnitPriceId: line.variantUnitPriceId,
          movementType: line.isDefectiveReplacement ? "REPLACEMENT" : "SALE",
          direction: "out",
          quantity: line.quantity,
          referenceType: "pos_exchange",
          referenceId: exchange.id,
          referenceNumber: exchangeNumber,
          reason: `Exchange replacement ${exchangeNumber}`,
          actorId: params.cashierId,
          itemLabel: `${line.variantName} (SKU: ${line.sku})`,
        });
      }

      // 9. Prepare and return the exchange receipt DTO
      const receiptReturnLines: PosExchangeReturnLineDto[] = params.returnItems.map((item) => ({
        orderItemId: Number(item.orderItemId),
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.totalPrice,
        condition: item.condition,
        reason: item.reason,
        reasonDetail: item.reasonDetail,
      }));

      const changeDue =
        params.paymentMode === "CASH" && params.cashReceived !== undefined && params.cashReceived !== null
          ? Math.max(0, round2(params.cashReceived - params.netPayable))
          : null;

      const receipt: PosExchangeReceiptDto = {
        exchangeUuid: exchange.uuid,
        exchangeNumber,
        originalOrderNumber: originalOrder.orderNumber,
        originalInvoiceNumber: originalOrder.invoice_number,
        originalPlacedAt: (originalOrder.placed_at ?? originalOrder.createdAt).toISOString(),
        exchangedAt: now.toISOString(),
        store: params.store,
        cashierName: params.cashierName,
        approvingManagerName: params.approvingManagerName ?? null,
        customerName: params.customerName ?? null,
        customerPhone: params.customerPhone ?? null,
        returnLines: receiptReturnLines,
        newLines: receiptNewLines,
        totalReturnedValue: params.totalReturnedValue,
        totalNewValue: params.totalNewValue,
        netPayable: params.netPayable,
        paymentMode: params.paymentMode ?? null,
        cashReceived: params.cashReceived ?? null,
        changeDue,
        paymentReference: params.paymentReference ?? null,
        reason: params.primaryReason,
        notes: params.notes ?? null,
        taxableValue: totalTaxableValue,
        cgstAmount: round2(totalTaxAmount / 2),
        sgstAmount: round2(totalTaxAmount / 2),
      };

      return receipt;
    });
  },
};
