import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma";
import { roleHasPermission } from "@/lib/permissions/server";
import { userRepository } from "@/features/users/repositories/user.repository";
import { posRepository, type PosBillLine } from "../repositories/pos.repository";
import { requireOpenSession } from "./pos-session.service";
import { resolveStore, toStoreDto } from "./pos-store.service";
import type {
  PosBillDto,
  PosBillLineDto,
  PosCustomerLookupDto,
  PosProductOption,
} from "../types";
import type {
  PosBillInput,
  PosCustomerLookupInput,
  PosProductSearchInput,
  PosVoidInput,
} from "../validations/pos.schema";

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

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
      item: {
        select: {
          id: true,
          name: true,
          isActive: true,
          deleted_at: true,
          style: {
            select: {
              id: true,
              name: true,
              product: {
                select: {
                  id: true,
                  name: true,
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
              },
            },
          },
        },
      },
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
  const item = variant?.item;
  const style = item?.style;
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
    itemName: style?.name ?? "",
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
  const item = variant?.item;
  const product = item?.style?.product;
  if (
    !row.isActive ||
    row.deleted_at ||
    !variant?.isActive ||
    variant.deleted_at ||
    !item?.isActive ||
    item.deleted_at ||
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
  const slab = row.variant?.item?.style?.product?.product_hsn_codes?.product_gst_rates;
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
                { variant: { item: { name: { contains: term } } } },
                { variant: { item: { style: { product: { name: { contains: term } } } } } },
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

    return rows.map((row) => {
      const info = describe(row);
      return {
        variantUnitPriceId: Number(row.id),
        sku: row.sku,
        label: info.label,
        productName: info.productName,
        variantName: info.variantName,
        colorName: info.colorName,
        sizeName: info.sizeName,
        unitPrice: Number(row.base_price),
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
      const unitPrice = Number(row.base_price);
      return { row, id, quantity, unitPrice, lineTotal: round2(unitPrice * quantity), info };
    });

    const subtotal = round2(priced.reduce((sum, line) => sum + line.lineTotal, 0));

    // Discount gate. A cashier with no POS_DISCOUNT cannot discount at all; one
    // with it stays inside the counter's cap. Without this, a cashier could
    // write off any amount and nothing in the bill would show it was irregular.
    let discountAmount = round2(Math.min(input.discountAmount ?? 0, subtotal));
    if (discountAmount > 0) {
      const mayDiscount = await roleHasPermission(actor.role, "POS_DISCOUNT");
      if (!mayDiscount) {
        throw ApiError.forbidden("You need a manager to apply a discount");
      }
      const cap = store.maxCashierDiscountPercent;
      const isManager = await roleHasPermission(actor.role, "POS_VOID");
      if (!isManager && cap > 0 && discountAmount > round2((subtotal * cap) / 100)) {
        throw ApiError.forbidden(`A discount above ${cap}% needs a manager`);
      }
      if (!isManager && cap === 0) {
        throw ApiError.forbidden("A discount needs a manager");
      }
    } else {
      discountAmount = 0;
    }

    // Spread the bill discount across lines by value, so each order line carries
    // its own share and per-line GST is computed on what was actually charged.
    // The last line absorbs the rounding remainder, so the parts always add up.
    let discountLeft = discountAmount;
    const lines: PosBillLine[] = [];
    const receiptLines: PosBillLineDto[] = [];
    let taxTotal = 0;
    let taxableTotal = 0;

    priced.forEach((line, index) => {
      const isLast = index === priced.length - 1;
      const share = isLast
        ? round2(discountLeft)
        : round2(subtotal > 0 ? (discountAmount * line.lineTotal) / subtotal : 0);
      discountLeft = round2(discountLeft - share);

      const charged = round2(line.lineTotal - share);
      const gstPercent = gstPercentOf(line.row);
      // Catalogue prices include GST, so the tax is carved out of what the
      // customer pays rather than added on top.
      const taxable = gstPercent > 0 ? round2(charged / (1 + gstPercent / 100)) : charged;
      const tax = round2(charged - taxable);
      taxTotal = round2(taxTotal + tax);
      taxableTotal = round2(taxableTotal + taxable);

      const variant = line.row.variant!;
      const item = variant.item!;
      const style = item.style!;
      const product = style.product!;

      lines.push({
        productId: product.id,
        styleId: style.id,
        itemId: item.id,
        variantId: variant.id,
        variantUnitPriceId: line.row.id,
        productName: product.name,
        itemName: style.name,
        variantName: variant.variant_name,
        attributes: line.info.attributes,
        sku: line.row.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: share,
        taxAmount: tax,
        totalPrice: charged,
      });

      receiptLines.push({
        sku: line.row.sku,
        description: line.info.label,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: share,
        lineTotal: charged,
      });
    });

    const totalAmount = round2(subtotal - discountAmount);

    if (input.paymentMode === "CASH" && input.cashReceived !== undefined) {
      if (input.cashReceived < totalAmount) {
        throw ApiError.badRequest(
          `Cash received (${input.cashReceived.toFixed(2)}) is less than the bill total (${totalAmount.toFixed(2)})`
        );
      }
    }

    // A phone that matches an account files the bill under that customer, so it
    // shows in their order history; anything else is a walk-in on this bill only.
    const matched = input.customerPhone
      ? await db.user.findFirst({
          where: { phone: input.customerPhone, is_active: true },
          select: { id: true, name: true, phone: true },
        })
      : null;

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
      subtotal,
      discountAmount,
      taxAmount: taxTotal,
      totalAmount,
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
      subtotal,
      discountAmount,
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
        user: { select: { name: true } },
      },
    });

    return orders.map((order) => ({
      orderUuid: order.uuid,
      orderNumber: order.orderNumber,
      invoiceNumber: order.invoice_number,
      totalAmount: Number(order.totalAmount),
      voided: order.order_status === "cancelled",
      billedAt: order.placed_at?.toISOString() ?? null,
      customerName: order.manual_customer_name ?? order.user?.name ?? null,
    }));
  },
};
