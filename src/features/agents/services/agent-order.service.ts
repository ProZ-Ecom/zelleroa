import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { offerService } from "@/features/offers/services/offer.service";
import { orderRepository } from "@/features/orders/repositories/order.repository";
import { getShippingCharge } from "@/features/orders/shipping";
import { findAssignedCustomer } from "./customer-assignment.service";
import type { AgentPlaceOrderInput } from "../validations/agent-order.schema";

interface Address {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Orders a Sales Partner places on behalf of one of THEIR customers, or a walk-in buyer with no account. */
export const agentOrderService = {
  async placeOrder(agentId: bigint, input: AgentPlaceOrderInput) {
    const agent = await db.user.findUnique({
      where: { id: agentId },
      select: { referral_code: true, agent_profile: { select: { agent_code: true } } },
    });
    if (!agent) throw ApiError.unauthorized();

    // 1. Who the order is for. A registered customer must be assigned to THIS agent - never trust the id alone.
    let buyerId = agentId;
    let manualCustomer: { name: string; phone: string; email: string | null } | null = null;
    let addressSource: Address;

    if (input.customerId) {
      const customer = await findAssignedCustomer(agentId, input.customerId);
      if (!customer) throw ApiError.forbidden("This customer is not assigned to you");
      if (!customer.is_active || customer.status !== "active") throw ApiError.badRequest("This customer's account is inactive");
      buyerId = customer.id;
      if (input.shippingAddressId) {
        const ref = input.shippingAddressId;
        const a = await db.customerAddress.findFirst({
          where: {
            userId: customer.id,
            is_active: true,
            deleted_at: null,
            OR: [{ uuid: ref }, ...(/^\d+$/.test(ref) ? [{ id: BigInt(ref) }] : [])],
          },
        });
        if (!a) throw ApiError.badRequest("Delivery address not found for this customer");
        addressSource = {
          fullName: a.full_name,
          phone: a.phone,
          addressLine1: a.address_line1,
          addressLine2: a.address_line2,
          landmark: a.landmark,
          city: a.city,
          state: a.state,
          pincode: a.pincode,
          latitude: a.latitude ? Number(a.latitude) : null,
          longitude: a.longitude ? Number(a.longitude) : null,
        };
      } else {
        addressSource = input.shippingAddress!;
      }
    } else {
      const m = input.manualCustomer!;
      manualCustomer = { name: m.name, phone: m.phone, email: m.email || null };
      addressSource = input.shippingAddress!;
    }

    // 2. Lines: price, stock and availability all come from the database.
    const ids = [...new Set(input.items.map((i) => i.variantUnitPriceId))];
    const rows = await db.variantUnitPrice.findMany({
      where: { uuid: { in: ids } },
      include: {
        variant: {
          include: {
            item: { include: { style: { include: { product: true } } } },
            variant_attribute_values: {
              include: { product_attributes: { select: { name: true } }, attribute_values: { select: { value: true } } },
            },
          },
        },
        attribute_value: { include: { attribute: { select: { name: true } } } },
        product_units: { select: { name: true, code: true } },
        inventories: { select: { quantity_available: true } },
      },
    });
    const byUuid = new Map(rows.map((r) => [r.uuid, r]));

    // Merge duplicate lines for the same SKU so stock is checked against the combined quantity.
    const wanted = new Map<string, number>();
    for (const i of input.items) wanted.set(i.variantUnitPriceId, (wanted.get(i.variantUnitPriceId) ?? 0) + i.quantity);

    const lines = [...wanted].map(([uuid, quantity]) => {
      const r = byUuid.get(uuid);
      const variant = r?.variant;
      const item = variant?.item;
      const style = item?.style;
      const product = style?.product;
      if (
        !r || !r.isActive || r.deleted_at ||
        !variant?.isActive || variant.deleted_at ||
        !item?.isActive || item.deleted_at ||
        !style || !product?.isActive || product.deleted_at
      ) {
        throw ApiError.badRequest("One of the selected products is no longer available");
      }
      const available = r.inventories?.quantity_available ?? 0;
      if (quantity > available) {
        throw ApiError.badRequest(`Only ${available} left in stock for "${variant.variant_name}" (SKU: ${r.sku})`);
      }
      const attributes: Array<{ name: string; value: string }> = [];
      if (variant.color_name) attributes.push({ name: "Color", value: variant.color_name });
      if (r.attribute_value) {
        attributes.push({ name: r.attribute_value.attribute?.name || "Size", value: r.attribute_value.value });
      } else if (Number(r.unit_value) > 0 && r.product_units) {
        attributes.push({ name: "Size", value: `${Number(r.unit_value)} ${r.product_units.code || r.product_units.name}` });
      }
      for (const av of variant.variant_attribute_values ?? []) {
        const name = av.product_attributes?.name;
        const value = av.attribute_values?.value;
        if (name && value && !attributes.some((a) => a.name === name && a.value === value)) attributes.push({ name, value });
      }
      return {
        uuid,
        attributes,
        quantity,
        unitPrice: Number(r.base_price),
        productId: product.id,
        styleId: style.id,
        itemId: item.id,
        variantId: variant.id,
        variantUnitPriceId: r.id,
        productName: product.name,
        itemName: style.name,
        variantName: variant.variant_name,
        sku: r.sku,
      };
    });

    // 3. Offers use the same engine as the storefront; shipping the same rate table.
    const pricing = await offerService.priceCartItems(
      lines.map((l) => ({ itemId: l.uuid, quantity: l.quantity, unitPrice: l.unitPrice }))
    );
    const items = lines.map((l, idx) => {
      const p = pricing.lines[idx];
      return {
        productId: l.productId,
        styleId: l.styleId,
        itemId: l.itemId,
        variantId: l.variantId,
        variantUnitPriceId: l.variantUnitPriceId,
        productName: l.productName,
        itemName: l.itemName,
        attributes: l.attributes,
        variantName: l.variantName,
        sku: l.sku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: p.discountAmount,
        taxAmount: 0,
        totalPrice: p.finalLineTotal,
      };
    });
    const shippingCharge = getShippingCharge(addressSource.state, input.deliveryMethod || "standard");
    const totalAmount = pricing.subtotal - pricing.totalDiscount + shippingCharge;

    const address = {
      fullName: addressSource.fullName,
      phone: addressSource.phone,
      addressLine1: addressSource.addressLine1,
      addressLine2: addressSource.addressLine2 ?? null,
      landmark: addressSource.landmark ?? null,
      city: addressSource.city,
      state: addressSource.state,
      pincode: addressSource.pincode ?? "",
      country: "India",
      latitude: addressSource.latitude ?? null,
      longitude: addressSource.longitude ?? null,
    };

    return orderRepository.createCustomerOrderTransaction({
      userId: buyerId,
      agentId,
      referralCode: agent.referral_code ?? agent.agent_profile?.agent_code ?? null,
      orderSource: "AGENT_PLACED_FOR_CUSTOMER",
      orderedById: agentId,
      manualCustomer,
      cartId: null,
      subtotal: pricing.subtotal,
      discountAmount: pricing.totalDiscount,
      shippingCharge,
      totalAmount,
      orderStatus: "confirmed",
      paymentStatus: "pending",
      paymentMethod: "COD",
      notes: input.notes,
      shippingAddress: address,
      billingAddress: address,
      items,
    });
  },
};
