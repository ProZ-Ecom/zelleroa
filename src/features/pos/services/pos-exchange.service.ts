import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { roleHasPermission } from "@/lib/permissions/server";
import { offerService } from "@/features/offers/services/offer.service";
import { requireOpenSession } from "./pos-session.service";
import { resolveStore, toStoreDto } from "./pos-store.service";
import {
  assertSellable,
  describe,
  gstPercentOf,
  resolveStaffId,
  sellableOf,
  skuInclude,
} from "./pos.service";
import {
  posExchangeRepository,
  type NewItemExecutionParam,
  type ReturnItemExecutionParam,
} from "../repositories/pos-exchange.repository";
import type { PosExchangeBillLookupDto, PosExchangeReceiptDto } from "../types";
import type { PosExchangeInput, PosExchangeLookupInput } from "../validations/pos-exchange.schema";

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export const posExchangeService = {
  /**
   * Looks up bills eligible for exchange at the cashier's active store.
   */
  async lookupBills(
    input: PosExchangeLookupInput,
    actor: { email?: string | null; role?: string | null }
  ): Promise<PosExchangeBillLookupDto[]> {
    const cashierId = await resolveStaffId(actor.email);
    const session = await requireOpenSession(db, cashierId);

    const bills = await posExchangeRepository.findBillsForExchange(input.query, session.store_id);
    return bills;
  },

  /**
   * Processes a counter return / exchange with atomic inventory adjustments and
   * strict enforcement of the "Mandatory Full Value Utilization" rule.
   */
  async processExchange(
    input: PosExchangeInput,
    actor: { email?: string | null; role?: string | null }
  ): Promise<PosExchangeReceiptDto> {
    const cashierId = await resolveStaffId(actor.email);
    const session = await requireOpenSession(db, cashierId);
    const storeRow = await resolveStore(db, session.store_id);
    const store = await toStoreDto(storeRow);

    // 1. Authorisation: check if cashier has POS_RETURN permission or manager override
    const cashierMayReturn = await roleHasPermission(actor.role, "POS_RETURN");
    let approvingManagerId: bigint | null = null;
    let approvingManagerName: string | null = null;

    if (!cashierMayReturn) {
      if (!input.managerUserId) {
        throw ApiError.forbidden("Manager approval is required to process returns and exchanges");
      }
      const manager = await db.user.findUnique({
        where: { id: BigInt(input.managerUserId), is_active: true },
        include: { role: { select: { name: true } } },
      });
      if (!manager) {
        throw ApiError.forbidden("Manager not found or inactive");
      }
      const managerMayReturn = await roleHasPermission(manager.role?.name, "POS_RETURN");
      if (!managerMayReturn) {
        throw ApiError.forbidden("The selected manager does not have permission to authorize exchanges");
      }
      approvingManagerId = manager.id;
      approvingManagerName = manager.name;
    }

    // 2. Fetch and validate original order and its line items
    const originalOrder = await db.order.findUnique({
      where: { id: BigInt(input.originalOrderId) },
      include: {
        items: true,
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!originalOrder) {
      throw ApiError.notFound("Original bill not found");
    }
    if (originalOrder.store_id !== session.store_id) {
      throw ApiError.badRequest("Returns and exchanges can only be processed at the store where originally purchased");
    }
    if (originalOrder.order_status === "cancelled") {
      throw ApiError.badRequest("Cannot exchange items from a voided or cancelled bill");
    }

    const origItemMap = new Map(originalOrder.items.map((i) => [String(i.id), i]));

    // 3. Process and value RETURN items
    const returnItems: ReturnItemExecutionParam[] = [];
    let totalReturnedValue = 0;
    let primaryReason = "Exchange";

    for (const ret of input.returnItems) {
      const origItem = origItemMap.get(String(ret.orderItemId));
      if (!origItem) {
        throw ApiError.badRequest(`Item #${ret.orderItemId} was not found on original bill`);
      }
      if (ret.quantity <= 0) {
        throw ApiError.badRequest("Return quantity must be greater than zero");
      }

      // Calculate effective per-unit price paid on the original bill
      const origQty = origItem.quantity;
      const lineTotalPaid = Number(origItem.total_price);
      const effectiveUnitPrice = origQty > 0 ? round2(lineTotalPaid / origQty) : 0;
      const returnLineTotal = round2(effectiveUnitPrice * ret.quantity);

      totalReturnedValue = round2(totalReturnedValue + returnLineTotal);
      primaryReason = ret.reason;

      returnItems.push({
        orderItemId: origItem.id,
        variantUnitPriceId: origItem.variantUnitPriceId ?? BigInt(0),
        sku: origItem.sku_snapshot,
        description: `${origItem.product_name_snapshot} (${origItem.variant_snapshot})`,
        quantity: ret.quantity,
        unitPrice: effectiveUnitPrice,
        totalPrice: returnLineTotal,
        condition: ret.condition,
        reason: ret.reason,
        reasonDetail: ret.reasonDetail ?? null,
      });
    }

    // 4. Process and value NEW replacement items
    const newItemsWanted = new Map<number, number>();
    for (const item of input.newItems) {
      newItemsWanted.set(
        item.variantUnitPriceId,
        (newItemsWanted.get(item.variantUnitPriceId) ?? 0) + item.quantity
      );
    }

    const vupRows = await db.variantUnitPrice.findMany({
      where: { id: { in: [...newItemsWanted.keys()].map((id) => BigInt(id)) } },
      include: skuInclude,
    });
    const byVupId = new Map(vupRows.map((r) => [Number(r.id), r]));

    const pricedNewLines = [...newItemsWanted].map(([id, quantity]) => {
      const row = byVupId.get(id);
      if (!row) throw ApiError.badRequest("One of the replacement items is no longer available");
      assertSellable(row);

      const sellable = sellableOf(row);
      if (quantity > sellable) {
        throw ApiError.badRequest(
          `Insufficient stock for "${row.sku}". Available: ${sellable}, requested: ${quantity}`
        );
      }

      const info = describe(row);
      const basePrice = Number(row.base_price);
      return { row, id, quantity, basePrice, info };
    });

    // Evaluate catalog offers for replacement items
    const offerPricing = await offerService.priceCartItems(
      pricedNewLines.map((item) => ({
        itemId: item.row.uuid,
        quantity: item.quantity,
        unitPrice: item.basePrice,
      }))
    );

    const totalNewValue = round2(offerPricing.total);

    // 5. Build executable new lines with GST breakdown
    const newExecutionItems: NewItemExecutionParam[] = [];
    const defectiveSkuSet = new Set(
      input.newItems.filter((i) => i.isDefectiveReplacement).map((i) => i.variantUnitPriceId)
    );

    pricedNewLines.forEach((item, index) => {
      const offerLine = offerPricing.lines[index];
      const gstPercent = gstPercentOf(item.row);
      const charged = offerLine.finalLineTotal;
      const taxable = gstPercent > 0 ? round2(charged / (1 + gstPercent / 100)) : charged;
      const tax = round2(charged - taxable);

      const variant = item.row.variant!;
      const itemEntity = variant.item!;
      const style = itemEntity.style!;
      const product = style.product!;

      newExecutionItems.push({
        productId: product.id,
        styleId: style.id,
        itemId: itemEntity.id,
        variantId: variant.id,
        variantUnitPriceId: item.row.id,
        productName: product.name,
        itemName: style.name,
        variantName: variant.variant_name,
        attributes: item.info.attributes,
        sku: item.row.sku,
        quantity: item.quantity,
        unitPrice: item.basePrice,
        discountAmount: offerLine.discountAmount,
        taxAmount: tax,
        totalPrice: charged,
        isDefectiveReplacement: defectiveSkuSet.has(item.id),
      });
    });

    // 6. Net difference calculation & Strict Policy Enforcement
    const netPayable = round2(totalNewValue - totalReturnedValue);

    // Scenario 3: Lower-Value Exchange - MANDATORY FULL VALUE UTILIZATION
    if (netPayable < 0) {
      const deficit = Math.abs(netPayable);
      throw ApiError.badRequest(
        `Your exchange balance is ₹${totalReturnedValue.toFixed(2)}. Please select additional products worth ₹${deficit.toFixed(2)} to complete the exchange. Unused exchange balance cannot be refunded or converted into a voucher or store credit.`
      );
    }

    // Scenario 2: Higher-Value Exchange - Collect Difference
    if (netPayable > 0) {
      if (!input.paymentMode) {
        throw ApiError.badRequest("Please select a payment method for the additional payable difference");
      }
      if (input.paymentMode === "CASH" && input.cashReceived !== undefined && input.cashReceived !== null) {
        if (input.cashReceived < netPayable) {
          throw ApiError.badRequest(
            `Cash received (₹${input.cashReceived.toFixed(2)}) is less than net payable (₹${netPayable.toFixed(2)})`
          );
        }
      }
    }

    // 7. Counter address for GST compliance
    const billingAddress = {
      fullName: originalOrder.manual_customer_name ?? originalOrder.user?.name ?? "Counter Customer",
      phone: originalOrder.manual_customer_phone ?? originalOrder.user?.phone ?? "9999999999",
      addressLine1: store.addressLines[0] || "Store Counter",
      city: store.city || "Bengaluru",
      state: store.state || "Karnataka",
      pincode: store.pincode || "560001",
    };

    // 8. Execute atomic exchange transaction
    const cashierUser = await db.user.findUnique({
      where: { id: cashierId },
      select: { name: true },
    });

    return posExchangeRepository.executeExchange({
      storeId: session.store_id,
      storePrefix: store.invoicePrefix,
      store,
      sessionId: session.id,
      cashierId,
      cashierName: cashierUser?.name ?? "Cashier",
      approvingManagerId,
      approvingManagerName,
      buyerUserId: originalOrder.userId,
      originalOrderId: originalOrder.id,
      customerName: originalOrder.manual_customer_name ?? originalOrder.user?.name ?? null,
      customerPhone: originalOrder.manual_customer_phone ?? originalOrder.user?.phone ?? null,
      returnItems,
      newItems: newExecutionItems,
      totalReturnedValue,
      totalNewValue,
      netPayable,
      paymentMode: input.paymentMode ?? null,
      cashReceived: input.cashReceived ?? null,
      paymentReference: input.paymentReference ?? null,
      notes: input.notes ?? null,
      primaryReason,
      billingAddress,
    });
  },
};
