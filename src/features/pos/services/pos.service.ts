import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma";
import { roleHasPermission } from "@/lib/permissions/server";
import { userRepository } from "@/features/users/repositories/user.repository";
import { offerService } from "@/features/offers/services/offer.service";
import { couponValidationService } from "@/features/coupons/services/coupon-validation.service";
import { couponRepository } from "@/features/coupons/repositories/coupon.repository";
import { posRepository, type PosBillLine } from "../repositories/pos.repository";
import { POS_METHOD_CODES, requireOpenSession } from "./pos-session.service";
import { posStoreService, resolveStore, toStoreDto } from "./pos-store.service";
import type {
  PosBillDto,
  PosBillLineDto,
  PosCouponResult,
  PosCustomerLookupDto,
  PosPaymentMode,
  PosProductOption,
  PosPurchaseListItem,
  PosPurchasesResponse,
  PosPurchasesSummary,
} from "../types";
import type {
  PosBillInput,
  PosCouponValidateInput,
  PosCustomerLookupInput,
  PosProductSearchInput,
  PosPurchasesQueryInput,
  PosVoidInput,
} from "../validations/pos.schema";

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function methodCodeToPosMode(code?: string | null): PosPaymentMode {
  if (code === "POS_UPI") return "UPI";
  if (code === "POS_CARD") return "CARD";
  return "CASH";
}

/** Who the signed-in cashier is, as a user id. */
async function resolveStaffId(email?: string | null): Promise<bigint> {
  if (!email) throw ApiError.unauthorized("Sign in again to use the counter");
  const user = await userRepository.findByEmail(email);
  if (!user) throw ApiError.unauthorized("Sign in again to use the counter");
  return BigInt(user.internalId || user.id);
}

const skuInclude = {
  inventories: { select: { quantity_available: true, quantity_reserved: true } },
  product_units: { select: { name: true, code: true } },
  attribute_value: { select: { value: true, attribute: { select: { name: true } } } },
  variant: {
    select: {
      id: true,
      variant_name: true,
      color_name: true,
      isActive: true,
      deleted_at: true,
      variant_attribute_values: {
        select: {
          product_attributes: { select: { name: true } },
          attribute_values: { select: { value: true } },
        },
      },
      style: { select: { id: true, name: true, isActive: true, deleted_at: true, product: {
                select: {
                  id: true,
                  uuid: true,
                  name: true,
                  categoryId: true,
                  isActive: true,
                  deleted_at: true,
                  product_hsn_codes: {
                    select: {
                      code: true,
                      product_gst_rates: {
                        select: { cgst_percent: true, sgst_percent: true },
                      },
                    },
                  },
                },
              } } },
    },
  },
} satisfies Prisma.VariantUnitPriceInclude;

type SkuRow = Prisma.VariantUnitPriceGetPayload<{ include: typeof skuInclude }>;

/**
 * What the counter may sell right now: stock on hand minus what online carts
 * and unshipped orders are holding. The counter and the website share one pool,
 * so selling a reserved unit over the counter would oversell the web order.
 */
function sellableOf(row: SkuRow): number {
  const available = row.inventories?.quantity_available ?? 0;
  const reserved = row.inventories?.quantity_reserved ?? 0;
  return Math.max(0, available - reserved);
}

function describe(row: SkuRow) {
  const variant = row.variant;
  const style = variant?.style;
  const product = style?.product;

  const attributes: Array<{ name: string; value: string }> = [];
  if (variant?.color_name) attributes.push({ name: "Color", value: variant.color_name });
  if (row.attribute_value) {
    attributes.push({
      name: row.attribute_value.attribute?.name || "Size",
      value: row.attribute_value.value,
    });
  } else if (Number(row.unit_value) > 0 && row.product_units) {
    attributes.push({
      name: "Size",
      value: `${Number(row.unit_value)} ${row.product_units.code || row.product_units.name}`,
    });
  }
  for (const av of variant?.variant_attribute_values ?? []) {
    const name = av.product_attributes?.name;
    const value = av.attribute_values?.value;
    if (name && value && !attributes.some((a) => a.name === name && a.value === value)) {
      attributes.push({ name, value });
    }
  }

  return {
    productName: product?.name ?? "",
    styleName: style?.name ?? "",
    variantName: variant?.variant_name ?? "",
    colorName: variant?.color_name ?? null,
    sizeName: row.attribute_value?.value ?? null,
    attributes,
    label: [product?.name, variant?.variant_name, row.attribute_value?.value ?? row.product_units?.name]
      .filter(Boolean)
      .join(" · "),
  };
}

function assertSellable(row: SkuRow) {
  const variant = row.variant;
  const style = variant?.style;
  const product = style?.product;
  if (
    !row.isActive ||
    row.deleted_at ||
    !variant?.isActive ||
    variant.deleted_at ||
    !style?.isActive ||
    style.deleted_at ||
    !product?.isActive ||
    product.deleted_at
  ) {
    throw ApiError.badRequest(`"${row.sku}" is no longer on sale`);
  }
}

/**
 * GST percent for a line, from the product's HSN slab.
 *
 * A counter sale is always intra-state - the buyer is standing in the shop - so
 * the place of supply is the counter's own state and the tax splits CGST+SGST.
 * IGST never applies here, which is why only those two are read.
 */
function gstPercentOf(row: SkuRow): number {
  const slab = row.variant?.style?.product?.product_hsn_codes?.product_gst_rates;
  if (!slab) return 0;
  return Number(slab.cgst_percent) + Number(slab.sgst_percent);
}

export const posService = {
  /**
   * SKU lookup for the billing screen.
   *
   * `sku` is the fast path a cashier types all day: an exact, case-insensitive
   * match returning one row, so pressing Enter adds the item without a dropdown.
   * `search` is the fallback for a half-remembered name.
   */
  async searchProducts(input: PosProductSearchInput): Promise<PosProductOption[]> {
    const exact = input.sku?.trim();
    const term = input.search?.trim();

    const where: Prisma.VariantUnitPriceWhereInput = {
      isActive: true,
      deleted_at: null,
      variant: { isActive: true, deleted_at: null },
      ...(exact
        ? { sku: exact }
        : term
          ? {
              OR: [
                { sku: { contains: term } },
                { variant: { variant_name: { contains: term } } },
                { variant: { style: { name: { contains: term } } } },
                { variant: { style: { product: { name: { contains: term } } } } },
              ],
            }
          : {}),
    };

    const rows = await db.variantUnitPrice.findMany({
      where,
      include: skuInclude,
      orderBy: { id: "desc" },
      take: exact ? 1 : input.limit,
    });

    const pricing = await offerService.getBestUnitPrices(
      rows.map((row) => ({ itemId: row.uuid, unitPrice: Number(row.base_price) }))
    );

    return rows.map((row) => {
      const info = describe(row);
      const basePrice = Number(row.base_price);
      const offerResult = pricing.get(row.uuid);
      const isDiscounted = Boolean(offerResult?.offerApplied && offerResult.finalPrice < basePrice);
      const unitPrice = isDiscounted ? offerResult!.finalPrice : basePrice;
      const discountAmount = isDiscounted ? offerResult!.discountAmount : 0;
      const discountPercent = isDiscounted ? offerResult!.discountPercent : 0;
      const offerName = isDiscounted ? offerResult!.offer?.name ?? null : null;

      return {
        variantUnitPriceId: Number(row.id),
        sku: row.sku,
        label: info.label,
        productName: info.productName,
        variantName: info.variantName,
        colorName: info.colorName,
        sizeName: info.sizeName,
        originalPrice: basePrice,
        unitPrice,
        discountAmount,
        discountPercent,
        offerName,
        sellable: sellableOf(row),
      };
    });
  },

  /** Attach a walk-in to an existing account when their phone matches one. */
  async lookupCustomer(input: PosCustomerLookupInput): Promise<PosCustomerLookupDto> {
    const user = await db.user.findFirst({
      where: { phone: input.phone, is_active: true },
      select: { id: true, name: true },
    });
    return {
      userId: user ? Number(user.id) : null,
      name: user?.name ?? null,
      phone: input.phone,
      found: Boolean(user),
    };
  },

  /** Validate a coupon code against current POS cart lines. */
  async validateCoupon(
    input: PosCouponValidateInput,
    actor: { email?: string | null; role?: string | null }
  ): Promise<PosCouponResult> {
    const cashierId = await resolveStaffId(actor.email);
    await requireOpenSession(db, cashierId);

    const wanted = new Map<number, number>();
    for (const item of input.items) {
      wanted.set(
        item.variantUnitPriceId,
        (wanted.get(item.variantUnitPriceId) ?? 0) + item.quantity
      );
    }

    const rows = await db.variantUnitPrice.findMany({
      where: { id: { in: [...wanted.keys()].map((id) => BigInt(id)) } },
      include: skuInclude,
    });
    const byId = new Map(rows.map((r) => [Number(r.id), r]));

    const items = [...wanted].map(([id, quantity]) => {
      const row = byId.get(id);
      if (!row) throw ApiError.badRequest("One of the items is no longer available");
      assertSellable(row);
      return { row, quantity, basePrice: Number(row.base_price) };
    });

    const pricing = await offerService.priceCartItems(
      items.map((i) => ({
        itemId: i.row.uuid,
        quantity: i.quantity,
        unitPrice: i.basePrice,
      }))
    );

    const matched = input.customerPhone
      ? await db.user.findFirst({
          where: { phone: input.customerPhone, is_active: true },
          select: { id: true },
        })
      : null;

    const couponLines = items.map((item, index) => {
      const line = pricing.lines[index];
      const product = item.row.variant?.style?.product;
      return {
        productId: product?.id ?? BigInt(0),
        categoryId: product?.categoryId ?? null,
        unitPrice: item.quantity > 0 ? line.finalLineTotal / item.quantity : line.finalPrice,
        quantity: item.quantity,
      };
    });

    const validated = await couponValidationService.validate(
      input.code,
      matched?.id ?? cashierId,
      couponLines
    );

    return {
      couponId: Number(validated.couponId),
      code: validated.code,
      discountAmount: round2(validated.discountAmount),
      eligibleSubtotal: round2(validated.eligibleSubtotal),
    };
  },

  async getActiveCoupons(): Promise<any[]> {
    const result = await couponRepository.findAll({ isActive: true, limit: 10 });
    return result.data;
  },

  /**
   * Ring up a counter sale.
   *
   * Prices, stock and tax all come from the database; the client sends only
   * SKUs, quantities and how the customer paid. The discount is the one figure
   * the cashier can move, so it is checked against both their permission and
   * the counter's cap before it is applied.
   */
  async createBill(
    input: PosBillInput,
    actor: { email?: string | null; role?: string | null }
  ): Promise<PosBillDto> {
    const cashierId = await resolveStaffId(actor.email);
    // Reads, so no transaction of their own; the billing transaction below is
    // the one that has to be atomic.
    const session = await requireOpenSession(db, cashierId);
    const storeRow = await resolveStore(db, session.store_id);
    const store = await toStoreDto(storeRow);

    // Merge repeats of a SKU so stock is checked against the combined quantity.
    const wanted = new Map<number, number>();
    for (const item of input.items) {
      wanted.set(
        item.variantUnitPriceId,
        (wanted.get(item.variantUnitPriceId) ?? 0) + item.quantity
      );
    }

    const rows = await db.variantUnitPrice.findMany({
      where: { id: { in: [...wanted.keys()].map((id) => BigInt(id)) } },
      include: skuInclude,
    });
    const byId = new Map(rows.map((r) => [Number(r.id), r]));

    const priced = [...wanted].map(([id, quantity]) => {
      const row = byId.get(id);
      if (!row) throw ApiError.badRequest("One of the items is no longer available");
      assertSellable(row);

      const sellable = sellableOf(row);
      if (quantity > sellable) {
        const reserved = row.inventories?.quantity_reserved ?? 0;
        throw ApiError.badRequest(
          `Only ${sellable} of "${row.sku}" can be sold at the counter` +
            (reserved > 0 ? ` (${reserved} held for online orders)` : "")
        );
      }

      const info = describe(row);
      const basePrice = Number(row.base_price);
      return { row, id, quantity, basePrice, info };
    });

    // 1. Evaluate catalog offers for all lines
    const offerPricing = await offerService.priceCartItems(
      priced.map((item) => ({
        itemId: item.row.uuid,
        quantity: item.quantity,
        unitPrice: item.basePrice,
      }))
    );

    const originalSubtotal = round2(offerPricing.subtotal);
    const offerDiscount = round2(offerPricing.totalDiscount);
    const subtotalAfterOffers = round2(offerPricing.total);

    // 2. Resolve matched customer
    const matched = input.customerPhone
      ? await db.user.findFirst({
          where: { phone: input.customerPhone, is_active: true },
          select: { id: true, name: true, phone: true },
        })
      : null;

    // 3. Validate and apply coupon if provided
    let appliedCoupon: { id: bigint; code: string; discountAmount: number } | null = null;
    let couponDiscount = 0;

    if (input.couponCode?.trim()) {
      const couponLines = priced.map((item, index) => {
        const offerLine = offerPricing.lines[index];
        const product = item.row.variant?.style?.product;
        return {
          productId: product?.id ?? BigInt(0),
          categoryId: product?.categoryId ?? null,
          unitPrice: item.quantity > 0 ? offerLine.finalLineTotal / item.quantity : offerLine.finalPrice,
          quantity: item.quantity,
        };
      });

      const validated = await couponValidationService.validate(
        input.couponCode.trim(),
        matched?.id ?? cashierId,
        couponLines
      );
      appliedCoupon = {
        id: validated.couponId,
        code: validated.code,
        discountAmount: round2(validated.discountAmount),
      };
      couponDiscount = appliedCoupon.discountAmount;
    }

    // 4. Manual cashier discount (gated by permission and cap)
    const remainingBeforeManual = Math.max(0, subtotalAfterOffers - couponDiscount);
    let manualDiscount = round2(Math.min(input.discountAmount ?? 0, remainingBeforeManual));

    if (manualDiscount > 0) {
      const mayDiscount = await roleHasPermission(actor.role, "POS_DISCOUNT");
      if (!mayDiscount) {
        throw ApiError.forbidden("You need a manager to apply a discount");
      }
      const cap = store.maxCashierDiscountPercent;
      const isManager = await roleHasPermission(actor.role, "POS_VOID");
      if (!isManager && cap > 0 && manualDiscount > round2((subtotalAfterOffers * cap) / 100)) {
        throw ApiError.forbidden(`A discount above ${cap}% needs a manager`);
      }
      if (!isManager && cap === 0) {
        throw ApiError.forbidden("A discount needs a manager");
      }
    } else {
      manualDiscount = 0;
    }

    const totalDiscountAmount = round2(offerDiscount + couponDiscount + manualDiscount);
    const additionalDiscount = round2(couponDiscount + manualDiscount);

    // 5. Spread additional (coupon + manual) discount across lines by value
    let additionalLeft = additionalDiscount;
    const lines: PosBillLine[] = [];
    const receiptLines: PosBillLineDto[] = [];
    let taxTotal = 0;
    let taxableTotal = 0;

    priced.forEach((item, index) => {
      const offerLine = offerPricing.lines[index];
      const isLast = index === priced.length - 1;
      const additionalShare = isLast
        ? round2(additionalLeft)
        : round2(subtotalAfterOffers > 0 ? (additionalDiscount * offerLine.finalLineTotal) / subtotalAfterOffers : 0);
      additionalLeft = round2(additionalLeft - additionalShare);

      const totalLineDiscount = round2(offerLine.discountAmount + additionalShare);
      const charged = round2(Math.max(0, offerLine.originalLineTotal - totalLineDiscount));

      const gstPercent = gstPercentOf(item.row);
      // Catalogue prices include GST, so the tax is carved out of what the
      // customer pays rather than added on top.
      const taxable = gstPercent > 0 ? round2(charged / (1 + gstPercent / 100)) : charged;
      const tax = round2(charged - taxable);
      taxTotal = round2(taxTotal + tax);
      taxableTotal = round2(taxableTotal + taxable);

      const variant = item.row.variant!;
      const style = variant.style!;
      const product = style.product!;

      lines.push({
        productId: product.id,
        styleId: style.id,
        variantId: variant.id,
        variantUnitPriceId: item.row.id,
        productName: product.name,
        styleName: style.name,
        variantName: variant.variant_name,
        attributes: item.info.attributes,
        sku: item.row.sku,
        quantity: item.quantity,
        unitPrice: item.basePrice,
        discountAmount: totalLineDiscount,
        taxAmount: tax,
        totalPrice: charged,
      });

      receiptLines.push({
        sku: item.row.sku,
        description: item.info.label,
        quantity: item.quantity,
        unitPrice: item.basePrice,
        discountAmount: totalLineDiscount,
        lineTotal: charged,
      });
    });

    const totalAmount = round2(Math.max(0, originalSubtotal - totalDiscountAmount));

    if (input.paymentMode === "CASH" && input.cashReceived !== undefined) {
      if (input.cashReceived < totalAmount) {
        throw ApiError.badRequest(
          `Cash received (${input.cashReceived.toFixed(2)}) is less than the bill total (${totalAmount.toFixed(2)})`
        );
      }
    }

    // A phone that matches an account files the bill under that customer, so it
    // shows in their order history; anything else is a walk-in on this bill only.
    const customerName = matched?.name ?? input.customerName?.trim() ?? null;
    const customerPhone = matched?.phone ?? input.customerPhone ?? null;

    const created = await posRepository.createBill({
      storeId: storeRow.id,
      storePrefix: store.invoicePrefix,
      sessionId: session.id,
      cashierId,
      buyerUserId: matched ? matched.id : cashierId,
      manualCustomer: matched
        ? null
        : { name: customerName || "Walk-in customer", phone: customerPhone || "" },
      billingAddress: {
        fullName: customerName || "Walk-in customer",
        phone: customerPhone || store.phone || "",
        addressLine1: `${store.name} (counter sale)`,
        city: store.city || "",
        state: store.state || "",
        pincode: store.pincode || "",
      },
      lines,
      subtotal: originalSubtotal,
      discountAmount: totalDiscountAmount,
      taxAmount: taxTotal,
      totalAmount,
      coupon: appliedCoupon ? { id: appliedCoupon.id, discountAmount: couponDiscount } : null,
      paymentMode: input.paymentMode,
      paymentReference: input.paymentReference?.trim() || null,
      note: input.note?.trim() || null,
    });

    const cashier = await db.user.findUnique({
      where: { id: cashierId },
      select: { name: true },
    });

    return {
      orderUuid: created.orderUuid,
      orderNumber: created.orderNumber,
      invoiceNumber: created.invoiceNumber,
      billedAt: created.at.toISOString(),
      store,
      cashierName: cashier?.name ?? "",
      customerName,
      customerPhone,
      lines: receiptLines,
      subtotal: originalSubtotal,
      discountAmount: totalDiscountAmount,
      offerDiscount,
      couponDiscount,
      couponCode: appliedCoupon?.code ?? null,
      manualDiscount,
      taxableValue: taxableTotal,
      // Intra-state by definition at a counter, so the carved-out tax splits in half.
      cgstAmount: round2(taxTotal / 2),
      sgstAmount: round2(taxTotal - round2(taxTotal / 2)),
      totalAmount,
      paymentMode: input.paymentMode,
      cashReceived: input.paymentMode === "CASH" ? (input.cashReceived ?? null) : null,
      changeDue:
        input.paymentMode === "CASH" && input.cashReceived !== undefined
          ? round2(input.cashReceived - totalAmount)
          : null,
    };
  },

  /** Void a counter bill. Manager only; the route's POS_VOID guard enforces that. */
  async voidBill(input: PosVoidInput, actor: { email?: string | null }) {
    const actorId = await resolveStaffId(actor.email);
    return posRepository.voidBill({
      orderUuid: input.orderUuid,
      actorId,
      reason: input.reason,
    });
  },

  /** Today's counter bills for the signed-in cashier, newest first. */
  async recentBills(actor: { email?: string | null }, limit = 20) {
    const cashierId = await resolveStaffId(actor.email);
    const session = await db.pos_sessions.findFirst({
      where: { staff_user_id: cashierId, status: "OPEN" },
      orderBy: { id: "desc" },
      select: { id: true },
    });
    if (!session) return [];

    const orders = await db.order.findMany({
      where: { pos_session_id: session.id },
      orderBy: { id: "desc" },
      take: limit,
      select: {
        uuid: true,
        orderNumber: true,
        invoice_number: true,
        totalAmount: true,
        order_status: true,
        placed_at: true,
        manual_customer_name: true,
        manual_customer_phone: true,
        user: { select: { name: true, phone: true } },
        payments: {
          select: {
            payment_methods: { select: { code: true } },
          },
        },
        items: {
          select: { quantity: true },
        },
      },
    });

    return orders.map((order) => {
      const paymentCode = order.payments[0]?.payment_methods?.code;
      const paymentMode = methodCodeToPosMode(paymentCode);
      const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

      return {
        orderUuid: order.uuid,
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoice_number,
        totalAmount: Number(order.totalAmount),
        voided: order.order_status === "cancelled",
        billedAt: order.placed_at?.toISOString() ?? null,
        customerName: order.manual_customer_name ?? order.user?.name ?? null,
        customerPhone: order.manual_customer_phone ?? order.user?.phone ?? null,
        paymentMode,
        itemCount,
      };
    });
  },

  /** Full POS purchases list with filters, pagination, and sales totals. */
  async getPurchases(input: PosPurchasesQueryInput): Promise<PosPurchasesResponse> {
    const where: Prisma.OrderWhereInput = {
      order_source: "POS",
    };

    if (input.status === "delivered") {
      where.order_status = "delivered";
    } else if (input.status === "cancelled") {
      where.order_status = "cancelled";
    } else {
      where.order_status = { in: ["delivered", "cancelled"] };
    }

    if (input.staffUserId) {
      where.ordered_by_id = BigInt(input.staffUserId);
    }

    if (input.from || input.to) {
      where.placed_at = {
        ...(input.from ? { gte: new Date(`${input.from}T00:00:00.000Z`) } : {}),
        ...(input.to ? { lte: new Date(`${input.to}T23:59:59.999Z`) } : {}),
      };
    }

    if (input.paymentMode) {
      const methodCode = POS_METHOD_CODES[input.paymentMode];
      where.payments = {
        some: {
          payment_methods: {
            code: methodCode,
          },
        },
      };
    }

    if (input.search) {
      const term = input.search.trim();
      where.OR = [
        { orderNumber: { contains: term } },
        { invoice_number: { contains: term } },
        { manual_customer_name: { contains: term } },
        { manual_customer_phone: { contains: term } },
        { user: { name: { contains: term } } },
        { user: { phone: { contains: term } } },
        { items: { some: { sku_snapshot: { contains: term } } } },
        { items: { some: { product_name_snapshot: { contains: term } } } },
      ];
    }

    const page = input.page || 1;
    const limit = input.limit || 20;
    const skip = (page - 1) * limit;

    const [total, orders, allMatching] = await Promise.all([
      db.order.count({ where }),
      db.order.findMany({
        where,
        orderBy: { id: "desc" },
        skip,
        take: limit,
        include: {
          ordered_by: { select: { name: true } },
          store: { select: { name: true } },
          user: { select: { name: true, phone: true } },
          payments: {
            select: {
              gateway_payment_id: true,
              payment_methods: { select: { code: true, name: true } },
            },
          },
          items: {
            select: {
              product_name_snapshot: true,
              variant_snapshot: true,
              sku_snapshot: true,
              quantity: true,
            },
          },
        },
      }),
      db.order.findMany({
        where,
        select: {
          totalAmount: true,
          order_status: true,
          payments: {
            select: {
              payment_methods: { select: { code: true } },
            },
          },
        },
      }),
    ]);

    let totalCount = allMatching.length;
    let deliveredCount = 0;
    let voidedCount = 0;
    let grossSales = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;

    for (const o of allMatching) {
      const isDelivered = o.order_status === "delivered";
      const isVoided = o.order_status === "cancelled";
      const amount = Number(o.totalAmount);
      const paymentCode = o.payments[0]?.payment_methods?.code;
      const mode = methodCodeToPosMode(paymentCode);

      if (isDelivered) {
        deliveredCount++;
        grossSales = round2(grossSales + amount);
        if (mode === "CASH") cashSales = round2(cashSales + amount);
        else if (mode === "UPI") upiSales = round2(upiSales + amount);
        else if (mode === "CARD") cardSales = round2(cardSales + amount);
      } else if (isVoided) {
        voidedCount++;
      }
    }

    const summary: PosPurchasesSummary = {
      totalCount,
      deliveredCount,
      voidedCount,
      grossSales,
      netSales: grossSales,
      cashSales,
      upiSales,
      cardSales,
    };

    const data: PosPurchaseListItem[] = orders.map((order) => {
      const paymentCode = order.payments[0]?.payment_methods?.code;
      const mode = methodCodeToPosMode(paymentCode);
      const totalItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

      const itemsSummary =
        order.items
          .map((item) => `${item.product_name_snapshot} × ${item.quantity}`)
          .slice(0, 3)
          .join(", ") + (order.items.length > 3 ? ` +${order.items.length - 3} more` : "");

      return {
        orderUuid: order.uuid || "",
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoice_number,
        placedAt: (order.placed_at ?? order.createdAt).toISOString(),
        customerName: order.manual_customer_name ?? order.user?.name ?? null,
        customerPhone: order.manual_customer_phone ?? order.user?.phone ?? null,
        cashierName: order.ordered_by?.name ?? "Staff",
        storeName: order.store?.name ?? "Store",
        paymentMode: mode,
        paymentReference: order.payments[0]?.gateway_payment_id ?? null,
        itemCount: totalItemCount,
        itemsSummary,
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        taxAmount: Number(order.taxAmount),
        totalAmount: Number(order.totalAmount),
        status: order.order_status === "cancelled" ? "cancelled" : "delivered",
      };
    });

    return {
      data,
      summary,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  /** Complete itemized purchase detail for receipt re-print, audit, or invoice link. */
  async getPurchaseDetail(uuid: string): Promise<PosBillDto> {
    const order = await db.order.findFirst({
      where: { uuid, order_source: "POS" },
      include: {
        ordered_by: { select: { name: true } },
        store: true,
        user: { select: { name: true, phone: true } },
        items: true,
        payments: {
          include: {
            payment_methods: true,
            transactions: true,
          },
        },
        coupon_usage: {
          include: {
            coupons: { select: { code: true } },
          },
        },
      },
    });

    if (!order) {
      throw ApiError.notFound("Bill not found");
    }

    const storeDto = order.store
      ? await toStoreDto(order.store)
      : await posStoreService.getActiveStore(order.store_id);
    const paymentCode = order.payments[0]?.payment_methods?.code;
    const mode = methodCodeToPosMode(paymentCode);

    const lines: PosBillLineDto[] = order.items.map((item) => ({
      sku: item.sku_snapshot,
      description: item.product_name_snapshot + (item.variant_snapshot ? ` - ${item.variant_snapshot}` : ""),
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      discountAmount: Number(item.discount_amount),
      lineTotal: Number(item.total_price),
    }));

    const subtotal = Number(order.subtotal);
    const discountAmount = Number(order.discountAmount);
    const taxAmount = Number(order.taxAmount);
    const totalAmount = Number(order.totalAmount);
    const taxableValue = round2(totalAmount - taxAmount);
    const cgstAmount = round2(taxAmount / 2);
    const sgstAmount = round2(taxAmount - cgstAmount);

    const couponUsage = order.coupon_usage[0];

    return {
      orderUuid: order.uuid || "",
      orderNumber: order.orderNumber,
      invoiceNumber: order.invoice_number ?? order.orderNumber,
      billedAt: (order.placed_at ?? order.createdAt).toISOString(),
      store: storeDto,
      cashierName: order.ordered_by?.name ?? "Staff",
      customerName: order.manual_customer_name ?? order.user?.name ?? null,
      customerPhone: order.manual_customer_phone ?? order.user?.phone ?? null,
      lines,
      subtotal,
      discountAmount,
      couponDiscount: couponUsage ? Number(couponUsage.discount_amount) : undefined,
      couponCode: couponUsage?.coupons?.code ?? null,
      taxableValue,
      cgstAmount,
      sgstAmount,
      totalAmount,
      paymentMode: mode,
      cashReceived: null,
      changeDue: null,
    };
  },
};
