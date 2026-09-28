import crypto from "crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { offerService } from "@/features/offers/services/offer.service";
import { couponValidationService } from "@/features/coupons/services/coupon-validation.service";
import { customerAddressService } from "@/features/customers/services/customer-address.service";
import { cartRepository } from "@/features/cart/repositories/cart.repository";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt";
import { referralService, type ReferralAgent } from "@/features/agents/services/referral.service";
import { orderRepository } from "../repositories/order.repository";
import { getShippingCharge } from "../shipping";
import type {
  OrderDetailResponse,
  OrderListItemResponse,
  OrderListResponse,
  OrderStatusTransitionResponse,
  AdminOrdersCountResponse,
} from "../types";
import type {
  CustomerCreateOrderInput,
  GuestCreateOrderInput,
  CustomerOrdersQueryInput,
  CustomerOrdersListInput,
  AdminOrdersListInput,
  CancelOrderInput,
  ReturnOrderInput,
  OrderStatusTransitionInput,
} from "../validations/order.schema";
import type { orders_order_status } from "@/generated/prisma";

const CUSTOMER_ROLE_ID = BigInt(3);

export const orderService = {
  async createCustomerOrder(
    sessionUserId: string,
    input: CustomerCreateOrderInput,
    request?: NextRequest,
    /**
     * Explicit referral to attribute, bypassing cookie resolution. Used by
     * flows (e.g. the Razorpay redirect checkout) where order creation
     * happens server-to-server with no access to the customer's browser
     * cookies - the referral must have been resolved earlier and threaded
     * through instead. `undefined` (the default) means "resolve from the
     * request cookie as normal"; `null` explicitly means "no referral".
     */
    referralOverride?: ReferralAgent | null
  ): Promise<OrderDetailResponse> {
    const user = await userRepository.findById(sessionUserId);
    if (!user || !user.internalId) {
      throw ApiError.unauthorized("User not found");
    }
    if (!user.isActive || user.is_active === false) {
      throw ApiError.forbidden("Your account is inactive or blocked. Please contact support.");
    }

    const userId = user.internalId;

    // 1. Find active cart with active cart items
    const cart = await db.cart.findFirst({
      where: {
        userId,
        status: "active",
        is_active: true,
      },
      include: {
        items: {
          where: {
            is_active: true,
            // The cart view hides lines for deleted products, so the customer
            // can't remove them; don't let those block checkout.
            product: { is: { isActive: true, deleted_at: null } },
          },
          include: {
            product: true,
            style: true,
            item: true,
            variant_unit_price: {
              include: {
                variant: {
                  include: {
                    variant_attribute_values: {
                      include: {
                        product_attributes: { select: { name: true } },
                        attribute_values: { select: { value: true } },
                      },
                    },
                  },
                },
                attribute_value: {
                  include: { attribute: { select: { name: true } } },
                },
                product_units: { select: { name: true, code: true } },
                inventories: {
                  select: { quantity_available: true },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw ApiError.badRequest("Cart is empty or no active cart found");
    }

    // 2. Validate every cart item's product and variant unit price
    const orderItemsData: Array<{
      productId: bigint;
      styleId: bigint;
      itemId: bigint | null;
      variantId: bigint;
      variantUnitPriceId: bigint;
      productName: string;
      itemName: string;
      attributes: Array<{ name: string; value: string }>;
      variantName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      taxAmount: number;
      totalPrice: number;
      itemUuid: string;
      categoryId: bigint | null;
    }> = [];

    let subtotal = 0;

    for (const item of cart.items) {
      const unitPriceRow = item.variant_unit_price;
      const variant = unitPriceRow?.variant;

      if (
        !item.product ||
        !item.product.isActive ||
        item.product.deleted_at !== null ||
        !item.style ||
        !item.style.isActive ||
        item.style.deleted_at !== null ||
        !unitPriceRow ||
        !unitPriceRow.isActive ||
        unitPriceRow.deleted_at !== null ||
        !variant ||
        !variant.isActive ||
        variant.deleted_at !== null
      ) {
        const reason = !item.product
          ? "product missing"
          : !item.product.isActive || item.product.deleted_at !== null
            ? "product inactive/deleted"
            : !item.style
              ? "style missing"
              : !item.style.isActive || item.style.deleted_at !== null
                ? "style inactive/deleted"
                : !unitPriceRow
                  ? "price row missing"
                  : !unitPriceRow.isActive || unitPriceRow.deleted_at !== null
                    ? "price row inactive/deleted"
                    : !variant
                      ? "variant missing"
                      : "variant inactive/deleted";
        console.error(
          `[order] cart item ${item.id} unavailable: ${reason}`
        );
        throw ApiError.badRequest(
          `Product variant "${variant?.variant_name || item.product?.name || "item"}" is no longer available`
        );
      }

      const availableStock = unitPriceRow.inventories?.quantity_available ?? 0;
      if (item.quantity > availableStock) {
        throw ApiError.badRequest(
          `Only ${availableStock} left in stock for "${variant.variant_name}" (SKU: ${unitPriceRow.sku})`
        );
      }

      // The stored base price is the only price trusted here - never a value
      // that came in with the request. Offers are applied below, once every
      // line is known, because a minimum-cart-value offer depends on the
      // subtotal of the whole cart.
      const unitPrice = Number(unitPriceRow.base_price);

      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      const attributes: Array<{ name: string; value: string }> = [];
      if (variant.color_name) {
        attributes.push({ name: "Color", value: variant.color_name });
      }
      if (unitPriceRow.attribute_value) {
        attributes.push({
          name: unitPriceRow.attribute_value.attribute?.name || "Size",
          value: unitPriceRow.attribute_value.value,
        });
      } else if (Number(unitPriceRow.unit_value) > 0 && unitPriceRow.product_units) {
        attributes.push({
          name: "Size",
          value: `${Number(unitPriceRow.unit_value)} ${unitPriceRow.product_units.code || unitPriceRow.product_units.name}`,
        });
      }
      for (const av of variant.variant_attribute_values ?? []) {
        const name = av.product_attributes?.name;
        const value = av.attribute_values?.value;
        if (name && value && !attributes.some((a) => a.name === name && a.value === value)) {
          attributes.push({ name, value });
        }
      }

      orderItemsData.push({
        attributes,
        productId: item.productId,
        styleId: item.styleId,
        itemId: item.itemId,
        variantId: variant.id,
        variantUnitPriceId: item.variantUnitPriceId!,
        productName: item.product.name,
        itemName: item.style.name,
        variantName: variant.variant_name,
        sku: unitPriceRow.sku,
        quantity: item.quantity,
        unitPrice,
        discountAmount: 0,
        taxAmount: 0,
        totalPrice,
        itemUuid: unitPriceRow.uuid,
        categoryId: item.product.categoryId,
      });
    }

    // 2b. Apply offers. This is the same engine the storefront, cart and
    // checkout quote from, so the price the customer was shown is the price
    // the order is written at.
    const pricing = await offerService.priceCartItems(
      orderItemsData.map((item) => ({
        itemId: item.itemUuid,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    );

    for (const [index, line] of pricing.lines.entries()) {
      const orderItem = orderItemsData[index];
      orderItem.discountAmount = line.discountAmount;
      orderItem.totalPrice = line.finalLineTotal;
    }

    const offerDiscount = pricing.totalDiscount;
    subtotal = pricing.subtotal;

    // 2c. Validate and price the coupon (if any) against the priced-down lines,
    // so its restrictions and min-order check see what the customer actually pays.
    let appliedCoupon: { id: bigint; discountAmount: number } | undefined;
    if (input.couponCode) {
      const validated = await couponValidationService.validate(
        input.couponCode,
        userId,
        orderItemsData.map((item) => ({
          productId: item.productId,
          categoryId: item.categoryId,
          unitPrice: item.totalPrice / item.quantity,
          quantity: item.quantity,
        }))
      );
      appliedCoupon = { id: validated.couponId, discountAmount: validated.discountAmount };
    }
    const couponDiscount = appliedCoupon?.discountAmount ?? 0;
    const totalDiscount = offerDiscount + couponDiscount;

    // 3. Validate shipping address
    const isShippingNumeric = /^\d+$/.test(input.shippingAddressId);
    const shippingAddress = await db.customerAddress.findFirst({
      where: {
        userId,
        is_active: true,
        deleted_at: null,
        OR: [
          { uuid: input.shippingAddressId },
          ...(isShippingNumeric ? [{ id: BigInt(input.shippingAddressId) }] : []),
        ],
      },
    });

    if (!shippingAddress) {
      throw ApiError.badRequest(
        "Shipping address not found or does not belong to customer"
      );
    }

    // 4. Validate billing address if provided
    let billingAddress = shippingAddress;
    if (input.billingAddressId) {
      const isBillingNumeric = /^\d+$/.test(input.billingAddressId);
      const foundBilling = await db.customerAddress.findFirst({
        where: {
          userId,
          is_active: true,
          deleted_at: null,
          OR: [
            { uuid: input.billingAddressId },
            ...(isBillingNumeric ? [{ id: BigInt(input.billingAddressId) }] : []),
          ],
        },
      });

      if (!foundBilling) {
        throw ApiError.badRequest(
          "Billing address not found or does not belong to customer"
        );
      }

      billingAddress = foundBilling;
    }

    const paymentMethod = input.paymentMethod || "CARD";
    const isOnlinePayment = paymentMethod === "CARD" || paymentMethod === "UPI" || (paymentMethod as string) === "ONLINE" || (paymentMethod as string) === "RAZORPAY";
    // If explicitly verified through Razorpay, mark paid and confirmed; if COD, confirm order with payment pending; otherwise pending.
    const isVerifiedPaid = input.paymentDetails?.isPaid === true || (!isOnlinePayment && input.paymentDetails?.isSimulated === true);
    const paymentStatus: "paid" | "pending" = isVerifiedPaid ? "paid" : "pending";
    const orderStatus: "confirmed" | "pending" = paymentMethod === "COD" || isVerifiedPaid ? "confirmed" : "pending";



    // Delivery is free within Tamil Nadu and a flat charge for every other state.
    const payableBeforeShipping = subtotal - totalDiscount;
    const shippingCharge = getShippingCharge(shippingAddress.state);
    const totalAmount = payableBeforeShipping + shippingCharge;

    // Commission attribution is per ORDER: whichever valid agent referral code is active
    // right now gets this order. The customer's earlier orders/agents are never consulted.
    const referral =
      referralOverride !== undefined
        ? referralOverride
        : await referralService.resolveForOrder(BigInt(userId), request);

    // 5. Execute creation transaction
    return orderRepository.createCustomerOrderTransaction({
      userId,
      agentId: referral?.id ?? null,
      referralCode: referral?.referralCode ?? null,
      cartId: cart.id,
      subtotal,
      discountAmount: totalDiscount,
      shippingCharge,
      totalAmount,
      coupon: appliedCoupon,
      orderStatus,
      paymentStatus,
      paymentMethod,
      notes: input.notes,
      shippingAddress: {
        fullName: shippingAddress.full_name,
        phone: shippingAddress.phone,
        addressLine1: shippingAddress.address_line1,
        addressLine2: shippingAddress.address_line2,
        landmark: shippingAddress.landmark,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode ?? "",
        country: shippingAddress.country ?? "India",
        latitude: shippingAddress.latitude ? Number(shippingAddress.latitude) : null,
        longitude: shippingAddress.longitude ? Number(shippingAddress.longitude) : null,
      },
      billingAddress: {
        fullName: billingAddress.full_name,
        phone: billingAddress.phone,
        addressLine1: billingAddress.address_line1,
        addressLine2: billingAddress.address_line2,
        landmark: billingAddress.landmark,
        city: billingAddress.city,
        state: billingAddress.state,
        pincode: billingAddress.pincode ?? "",
        country: billingAddress.country ?? "India",
        latitude: billingAddress.latitude ? Number(billingAddress.latitude) : null,
        longitude: billingAddress.longitude ? Number(billingAddress.longitude) : null,
      },
      items: orderItemsData,
    });
  },

  /**
   * Places an order for a visitor with no account. A "shadow" customer record
   * is created (or reused) from their email with no password set, so the
   * order creation path below is the exact same one a logged-in customer
   * uses. If they later reset the password on that email, they see every
   * order placed as a guest under it - that's the intended "claim" flow.
   *
   * @param guestSessionId The guest cart cookie value, so their anonymous
   * cart can be handed over to the new/existing shadow account before order
   * creation, which otherwise only ever looks up carts by `userId`.
   */
  async createGuestOrder(
    input: GuestCreateOrderInput,
    guestSessionId: string | null,
    request?: NextRequest
  ): Promise<{ order: OrderDetailResponse; accessToken: string; refreshToken: string }> {
    if (!guestSessionId) {
      throw ApiError.badRequest("Your cart could not be found. Please add items again.");
    }

    let shadowUser = await userRepository.findByEmail(input.email);

    if (shadowUser) {
      // A real account already owns this email - never auto-login as someone
      // else's account just because a guest typed their address in checkout.
      if (shadowUser.password_hash) {
        throw ApiError.conflict(
          "An account already exists with this email. Please log in to continue."
        );
      }
      if (!shadowUser.isActive) {
        throw ApiError.forbidden("This account is inactive or blocked. Please contact support.");
      }
    } else {
      await db.user.create({
        data: {
          uuid: crypto.randomUUID(),
          name: input.fullName,
          email: input.email,
          phone: null, // the phone on file is the address's, not a verified account phone
          password_hash: null,
          role: { connect: { id: CUSTOMER_ROLE_ID } },
          status: "active",
        },
      });
      shadowUser = await userRepository.findByEmail(input.email);
    }

    if (!shadowUser || !shadowUser.internalId) {
      throw ApiError.badRequest("Could not create your order. Please try again.");
    }

    const address = await customerAddressService.createAddress(shadowUser.uuid, {
      addressType: "shipping",
      fullName: input.fullName,
      phone: input.phone,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      landmark: input.landmark,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      country: "India",
      isDefault: true,
    });

    await cartRepository.claimGuestCart(guestSessionId, BigInt(shadowUser.internalId));

    const order = await this.createCustomerOrder(
      shadowUser.uuid,
      {
        shippingAddressId: address.id,
        notes: input.notes,
        paymentMethod: input.paymentMethod || "COD",
        paymentDetails: input.paymentDetails,
        couponCode: input.couponCode,
      },
      request
    );

    const userRole = shadowUser.roleName || "CUSTOMER";
    const accessToken = generateAccessToken({
      userId: shadowUser.uuid,
      email: shadowUser.email ?? "",
      role: userRole,
    });
    const refreshToken = generateRefreshToken({ userId: shadowUser.uuid });

    return { order, accessToken, refreshToken };
  },

  async getCustomerOrders(
    sessionUserId: string,
    query: CustomerOrdersListInput | CustomerOrdersQueryInput = {}
  ): Promise<OrderListResponse<OrderDetailResponse>> {
    const user = await userRepository.findById(sessionUserId);
    if (!user || !user.internalId) {
      throw ApiError.unauthorized("User not found");
    }
    if (!user.isActive || user.is_active === false) {
      throw ApiError.forbidden("Your account is inactive or blocked. Please contact support.");
    }

    return orderRepository.findCustomerOrders(user.internalId, query);
  },

  async getCustomerOrderByUuid(
    sessionUserId: string,
    uuid: string
  ): Promise<OrderDetailResponse> {
    const user = await userRepository.findById(sessionUserId);
    if (!user || !user.internalId) {
      throw ApiError.unauthorized("User not found");
    }
    if (!user.isActive || user.is_active === false) {
      throw ApiError.forbidden("Your account is inactive or blocked. Please contact support.");
    }

    const order = await orderRepository.findCustomerOrderByUuid(
      user.internalId,
      uuid
    );

    if (!order) {
      throw ApiError.notFound("Order not found");
    }

    return order;
  },

  async getAdminOrders(
    query: AdminOrdersListInput
  ): Promise<OrderListResponse<OrderListItemResponse>> {
    return orderRepository.findAdminOrders(query);
  },

  async countAdminOrders(
    query: AdminOrdersListInput
  ): Promise<AdminOrdersCountResponse> {
    return orderRepository.countAdminOrders(query);
  },

  async getAdminOrderByUuid(uuid: string): Promise<OrderDetailResponse> {
    const order = await orderRepository.findAdminOrderByUuid(uuid);
    if (!order) {
      throw ApiError.notFound("Order not found");
    }
    return { ...order, referral: await orderRepository.findOrderReferral(uuid) };
  },

  async cancelCustomerOrder(
    sessionUserId: string,
    uuid: string,
    input?: CancelOrderInput
  ): Promise<OrderDetailResponse> {
    const user = await userRepository.findById(sessionUserId);
    if (!user || !user.internalId) {
      throw ApiError.unauthorized("User not found");
    }

    const order = await db.order.findFirst({
      where: {
        uuid,
        userId: user.internalId,
        is_active: true,
      },
    });

    if (!order) {
      throw ApiError.notFound("Order not found");
    }

    // Cancellation window: pending, confirmed, processing
    const cancellableStatuses = ["pending", "confirmed", "processing"];
    if (!cancellableStatuses.includes(order.order_status)) {
      throw ApiError.badRequest(
        `Order cannot be cancelled in '${order.order_status}' status`
      );
    }

    return orderRepository.cancelOrderTransaction({
      orderId: order.id,
      note: input?.note || "Cancelled by customer",
      changedBy: user.internalId,
    });
  },

  async cancelAdminOrder(
    adminSessionUserId: string,
    uuid: string,
    input?: CancelOrderInput
  ): Promise<OrderDetailResponse> {
    const adminUser = await userRepository.findById(adminSessionUserId);
    if (!adminUser || !adminUser.internalId) {
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }

    const order = await db.order.findFirst({
      where: {
        uuid,
        is_active: true,
      },
    });

    if (!order) {
      throw ApiError.notFound("Order not found");
    }

    if (
      order.order_status === "delivered" ||
      order.order_status === "returned" ||
      order.order_status === "cancelled"
    ) {
      throw ApiError.badRequest(
        `Cannot cancel an order that is already '${order.order_status}'`
      );
    }

    return orderRepository.cancelOrderTransaction({
      orderId: order.id,
      note: input?.note || "Cancelled by admin",
      changedBy: adminUser.internalId,
    });
  },

  async returnCustomerOrder(
    sessionUserId: string,
    uuid: string,
    input?: ReturnOrderInput
  ): Promise<OrderDetailResponse> {
    const user = await userRepository.findById(sessionUserId);
    if (!user || !user.internalId) {
      throw ApiError.unauthorized("User not found");
    }

    const order = await db.order.findFirst({
      where: {
        uuid,
        userId: user.internalId,
        is_active: true,
      },
    });

    if (!order) {
      throw ApiError.notFound("Order not found");
    }

    if (order.order_status !== "delivered") {
      throw ApiError.badRequest("Only delivered orders can be returned");
    }

    return orderRepository.returnOrderTransaction({
      orderId: order.id,
      note: input?.note || "Return requested by customer",
      changedBy: user.internalId,
    });
  },

  async returnAdminOrder(
    adminSessionUserId: string,
    uuid: string,
    input?: ReturnOrderInput
  ): Promise<OrderDetailResponse> {
    const adminUser = await userRepository.findById(adminSessionUserId);
    if (!adminUser || !adminUser.internalId) {
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }

    const order = await db.order.findFirst({
      where: {
        uuid,
        is_active: true,
      },
    });

    if (!order) {
      throw ApiError.notFound("Order not found");
    }

    if (order.order_status !== "delivered") {
      throw ApiError.badRequest("Only delivered orders can be returned");
    }

    return orderRepository.returnOrderTransaction({
      orderId: order.id,
      note: input?.note || "Return processed by admin",
      changedBy: adminUser.internalId,
    });
  },

  async transitionOrderStatus(
    adminSessionUserId: string,
    uuid: string,
    expectedCurrentStatus: orders_order_status,
    newStatus: orders_order_status,
    input?: OrderStatusTransitionInput
  ): Promise<OrderStatusTransitionResponse> {
    const adminUser = await userRepository.findById(adminSessionUserId);
    if (!adminUser || !adminUser.internalId) {
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }

    const order = await db.order.findFirst({
      where: {
        uuid,
        is_active: true,
      },
    });

    if (!order) {
      throw ApiError.notFound("Order not found");
    }

    if (order.order_status !== expectedCurrentStatus) {
      throw ApiError.badRequest(
        `Order status is '${order.order_status}'. Only '${expectedCurrentStatus}' orders can be transitioned to '${newStatus}'.`
      );
    }

    const updated = await orderRepository.updateOrderStatusWithHistory({
      orderId: order.id,
      status: newStatus,
      note: input?.note,
      changedBy: adminUser.internalId,
    });

    return {
      id: updated.id,
      orderNumber: updated.orderNumber,
      status: updated.status,
    };
  },

  async confirmOrder(
    adminSessionUserId: string,
    uuid: string,
    input?: OrderStatusTransitionInput
  ): Promise<OrderStatusTransitionResponse> {
    return this.transitionOrderStatus(
      adminSessionUserId,
      uuid,
      "pending",
      "confirmed",
      input
    );
  },

  async startProcessingOrder(
    adminSessionUserId: string,
    uuid: string,
    input?: OrderStatusTransitionInput
  ): Promise<OrderStatusTransitionResponse> {
    return this.transitionOrderStatus(
      adminSessionUserId,
      uuid,
      "confirmed",
      "processing",
      input
    );
  },

  async markOrderAsPacked(
    adminSessionUserId: string,
    uuid: string,
    input?: OrderStatusTransitionInput
  ): Promise<OrderStatusTransitionResponse> {
    return this.transitionOrderStatus(
      adminSessionUserId,
      uuid,
      "processing",
      "packed",
      input
    );
  },

  async setOrderStatus(
    adminSessionUserId: string,
    uuid: string,
    body: { status: orders_order_status; note?: string }
  ) {
    const adminUser = await userRepository.findById(adminSessionUserId);
    if (!adminUser || !adminUser.internalId) {
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }

    const order = await db.order.findFirst({
      where: { uuid, is_active: true },
    });

    if (!order) {
      throw ApiError.notFound("Order not found");
    }

    const updated = await orderRepository.updateOrderStatusWithHistory({
      orderId: order.id,
      status: body.status,
      note: body.note,
      changedBy: adminUser.internalId,
    });

    return {
      id: updated.id,
      orderNumber: updated.orderNumber,
      status: updated.status,
    };
  },

  async cancelOrder(
    userId: number | string | bigint,
    orderIdOrUuid: string | number,
    input?: any
  ) {
    return this.cancelCustomerOrder(
      String(userId),
      String(orderIdOrUuid),
      typeof input === "string" ? { reason: input } : input
    );
  },

  async getOrder(userId: number | string | bigint, orderIdOrUuid: string | number) {
    return this.getCustomerOrderByUuid(String(userId), String(orderIdOrUuid));
  },

  async getOrderByNumber(
    userIdOrOrderNumber: number | string | bigint,
    orderNumber?: string
  ) {
    if (!orderNumber) {
      const order = await db.order.findFirst({
        where: { orderNumber: String(userIdOrOrderNumber), is_active: true },
      });
      if (!order) throw ApiError.notFound("Order not found");
      return this.getCustomerOrderByUuid(String(order.userId), order.uuid!);
    }
    const user = await userRepository.findById(String(userIdOrOrderNumber));
    if (!user || !user.internalId) throw ApiError.unauthorized("User not found");
    const order = await db.order.findFirst({
      where: { orderNumber, userId: user.internalId, is_active: true },
    });
    if (!order) throw ApiError.notFound("Order not found");
    return this.getCustomerOrderByUuid(String(userIdOrOrderNumber), order.uuid!);
  },

  async getOrders(userId: number | string | bigint, params: any = {}) {
    return this.getCustomerOrders(String(userId), params);
  },

  async placeOrder(userId: number | string | bigint, input: any, request?: NextRequest) {
    return this.createCustomerOrder(
      String(userId),
      {
        shippingAddressId: input.shippingAddressId || String(input.addressId),
        billingAddressId: input.billingAddressId,
        notes: input.notes,
        paymentMethod: input.paymentMethod || "CARD",
        paymentDetails: input.paymentDetails,
      },
      request
    );
  },

  async getCheckoutSummary(
    userId: number | string | bigint,
    deliveryMethod?: string,
    couponCode?: string,
    shippingAddressId?: string
  ) {
    const user = await userRepository.findById(String(userId));
    if (!user || !user.internalId) throw ApiError.unauthorized("User not found");
    const cart = await db.cart.findFirst({
      where: { userId: user.internalId, status: "active", is_active: true },
      include: {
        items: {
          where: { is_active: true },
          include: { variant_unit_price: true, product: { select: { categoryId: true } } },
        },
      },
    });

    // Priced from the live `base_price`, not the price captured when the item
    // was added, so the summary reflects today's catalog and today's offers.
    const cartItems = (cart?.items ?? []).filter((it) => it.variant_unit_price);
    const lines = cartItems.map((it) => ({
      itemId: it.variant_unit_price!.uuid,
      quantity: it.quantity,
      unitPrice: Number(it.variant_unit_price!.base_price ?? 0),
    }));

    const pricing = await offerService.priceCartItems(lines);
    // Delivery depends on the destination state; until an address is chosen
    // there is nothing to charge yet, and order creation recomputes it anyway.
    const isAddressNumeric = !!shippingAddressId && /^\d+$/.test(shippingAddressId);
    const shippingAddress = shippingAddressId
      ? await db.customerAddress.findFirst({
          where: {
            userId: user.internalId,
            is_active: true,
            deleted_at: null,
            OR: [
              { uuid: shippingAddressId },
              ...(isAddressNumeric ? [{ id: BigInt(shippingAddressId) }] : []),
            ],
          },
          select: { state: true },
        })
      : null;
    const deliveryCharge = shippingAddress ? getShippingCharge(shippingAddress.state) : 0;

    let couponResult: { code: string; discount: number } | null = null;
    let couponError: string | null = null;
    if (couponCode) {
      try {
        const validated = await couponValidationService.validate(
          couponCode,
          user.internalId,
          cartItems.map((it) => ({
            productId: it.productId,
            categoryId: it.product?.categoryId ?? null,
            unitPrice: Number(it.variant_unit_price!.base_price ?? 0),
            quantity: it.quantity,
          }))
        );
        couponResult = { code: validated.code, discount: validated.discountAmount };
      } catch (err) {
        couponError = err instanceof ApiError ? err.message : "Unable to apply coupon";
      }
    }

    const couponDiscount = couponResult?.discount ?? 0;
    const totalDiscount = pricing.totalDiscount + couponDiscount;
    const totalAmount = pricing.subtotal - totalDiscount + deliveryCharge;

    return {
      subtotal: pricing.subtotal,
      deliveryCharge,
      shippingCharge: deliveryCharge,
      discount: totalDiscount,
      discountAmount: totalDiscount,
      totalSavings: pricing.totalSavings + couponDiscount,
      items: pricing.lines,
      total: totalAmount,
      totalAmount,
      totals: {
        subtotal: pricing.subtotal,
        shipping: deliveryCharge,
        discount: totalDiscount,
        total: totalAmount,
      },
      coupon: couponResult,
      couponCode: couponResult?.code || null,
      couponError,
    };
  },
};
