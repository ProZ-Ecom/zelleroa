import crypto from "crypto";
import { createCommissionsForOrder, syncCommissionsWithOrderStatus } from "@/features/agents/services/commission.service";
import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { ApiError } from "@/lib/api/api-error";
import { formatVariantMeasurement } from "@/features/variants/utils/measurement.util";
import { reservationService } from "@/features/inventory/services/reservation.service";
import { recordStockMovement } from "@/features/inventory/services/stock-ledger.service";
import { getReturnWindow } from "@/features/returns/lib/policy";
import {
  buildOrderTimeline,
  summarizeReplacementRequest,
  summarizeReturnRequest,
} from "@/features/returns/lib/summary";
import {
  replacementRequestInclude,
  returnRequestInclude,
} from "@/features/returns/lib/includes";
import { getIndiaPostTrackingUrl, INDIA_POST_PARTNER_CODE } from "@/lib/shipping/india-post";
import type {
  OrderDetailResponse,
  OrderReferralDto,
  OrderListItemResponse,
  OrderItemResponse,
  OrderAddressResponse,
  OrderStatusHistoryResponse,
  OrderListResponse,
  AdminOrdersCountResponse,
} from "../types";
import type {
  CustomerOrdersQueryInput,
  CustomerOrdersListInput,
  AdminOrdersListInput,
} from "../validations/order.schema";

export const orderAddressInclude = Prisma.validator<Prisma.OrderAddressInclude>()({});

export const orderItemInclude = Prisma.validator<Prisma.OrderItemInclude>()({
  product: {
    select: {
      id: true,
      uuid: true,
      name: true,
      images: {
        where: { is_active: true },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
    },
  },
  style: {
    select: {
      id: true,
      uuid: true,
      name: true,
      images: {
        where: { is_active: true },
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        take: 1,
      },
    },
  },
  // Direct variant link — variant_unit_price is nullable, so it can't be the
  // only path to the color's images.
  variant: {
    select: {
      color_name: true,
      color_hex: true,
      product_variant_images: {
        where: { is_active: true },
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        take: 1,
      },
    },
  },
  variant_unit_price: {
    select: {
      id: true,
      uuid: true,
      sku: true,
      unit_value: true,
      attribute_value: { select: { value: true } },
      // Live sku/unit fallback for display; the authoritative values for an
      // already-placed order are the *_snapshot fields on OrderItem itself.
      product_units: {
        select: {
          id: true,
          uuid: true,
          name: true,
          code: true,
          type: true,
        },
      },
      variant: {
        select: {
          id: true,
          uuid: true,
          variant_name: true,
          color_name: true,
          product_variant_images: {
            where: { is_active: true },
            orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
            take: 1,
          },
        },
      },
    },
  },
});

export const orderDetailInclude = Prisma.validator<Prisma.OrderInclude>()({
  user: {
    select: {
      id: true,
      uuid: true,
      cust_id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  address: {
    where: { is_active: true },
  },
  items: {
    where: { is_active: true },
    include: orderItemInclude,
  },
  order_status_history: {
    where: { is_active: true },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  },
  return_requests: {
    where: { is_active: true },
    orderBy: { requested_at: "desc" },
    include: returnRequestInclude,
  },
  replacement_requests: {
    where: { is_active: true },
    orderBy: { requested_at: "desc" },
    include: replacementRequestInclude,
  },
  refunds: {
    where: { is_active: true },
    orderBy: { id: "asc" },
  },
  payments: {
    where: { status: "success" },
    orderBy: { id: "asc" },
    take: 1,
    select: { updatedAt: true },
  },
  shipments: {
    where: { is_active: true },
    orderBy: { id: "desc" },
    take: 1,
    include: {
      delivery_staff: {
        select: {
          id: true,
          uuid: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      delivery_partners: true,
      shipment_tracking: {
        where: { is_active: true },
        orderBy: { id: "asc" },
      },
    },
  },
});

export function formatOrderAddress(
  address?: Prisma.OrderAddressGetPayload<typeof orderAddressInclude> | null
): OrderAddressResponse | null {
  if (!address) return null;
  const addressType = address.type === "billing" ? "billing" : "shipping";
  return {
    id: address.uuid || String(address.id),
    type: address.type,
    addressType,
    fullName: address.full_name,
    phone: address.phone,
    addressLine1: address.address_line1,
    addressLine2: address.address_line2 ?? null,
    landmark: address.landmark ?? null,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country,
    latitude: address.latitude ? Number(address.latitude) : null,
    longitude: address.longitude ? Number(address.longitude) : null,
  };
}

export function formatOrderItem(
  item: Prisma.OrderItemGetPayload<{ include: typeof orderItemInclude }>
): OrderItemResponse {
  const unitPrice = item.variant_unit_price;
  const variant = unitPrice?.variant;
  const measurement = formatVariantMeasurement(
    unitPrice?.product_units,
    unitPrice?.unit_value ?? 0
  );

  // Most specific first: color (variant) → Style gallery → product.
  const primaryImage =
    variant?.product_variant_images?.[0]?.image_url ||
    item.variant?.product_variant_images?.[0]?.image_url ||
    item.style?.images?.[0]?.image_url ||
    item.product?.images?.[0]?.image_url ||
    null;

  return {
    id: item.uuid || String(item.id),
    productId: item.product?.uuid || String(item.productId),
    itemId: item.style?.uuid || String(item.styleId),
    variantId: variant?.uuid || String(variant?.id ?? ""),
    variantUnitPriceId: unitPrice?.uuid || String(item.variantUnitPriceId),
    productName: item.product_name_snapshot,
    itemName: item.item_name_snapshot,
    variantName: item.variant_snapshot,
    sku: item.sku_snapshot,
    measurement,
    // Historical selection; orders placed before snapshots existed fall back to live data.
    attributes: Array.isArray(item.attributes_snapshot)
      ? (item.attributes_snapshot as unknown as Array<{ name: string; value: string }>)
      : [
          ...(variant?.color_name ? [{ name: "Color", value: variant.color_name }] : []),
          ...(unitPrice?.attribute_value?.value
            ? [{ name: "Size", value: unitPrice.attribute_value.value }]
            : Number(unitPrice?.unit_value ?? 0) > 0 && unitPrice?.product_units
              ? [
                  {
                    name: "Size",
                    value: `${Number(unitPrice.unit_value)} ${unitPrice.product_units.code || unitPrice.product_units.name}`,
                  },
                ]
              : []),
        ],
    primaryImage,
    colorName: item.variant?.color_name ?? variant?.color_name ?? null,
    colorHex: item.variant?.color_hex ?? null,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
    discountAmount: Number(item.discount_amount ?? 0),
    taxAmount: Number(item.tax_amount),
    totalPrice: Number(item.total_price),
  };
}

export function formatOrderStatusHistory(
  history: Prisma.order_status_historyGetPayload<{}>
): OrderStatusHistoryResponse {
  return {
    id: String(history.id),
    status: history.status,
    note: history.note ?? null,
    createdAt: history.created_at,
  };
}

export function formatOrderDelivery(
  shipments?: Array<{
    id: bigint;
    uuid: string | null;
    assignment_status: string | null;
    created_at: Date;
    accepted_at: Date | null;
    delivered_at: Date | null;
    delivery_staff?: {
      id: bigint;
      uuid: string | null;
      name: string;
      email?: string | null;
      phone: string | null;
    } | null;
  }> | null
) {
  if (!shipments || shipments.length === 0) {
    return {
      isAssigned: false,
      assignmentStatus: null,
      deliveryId: null,
      staff: null,
      assignedAt: null,
    };
  }

  const latest = shipments[0];
  const staff = latest.delivery_staff;

  const isAssigned = latest.assignment_status !== null;

  return {
    isAssigned,
    assignmentStatus: latest.assignment_status || null,
    deliveryId: latest.uuid || String(latest.id),
    staff: staff
      ? {
          id: staff.uuid || String(staff.id),
          name: staff.name,
          email: staff.email ?? null,
          phone: staff.phone ?? null,
        }
      : null,
    assignedAt: latest.created_at ? latest.created_at.toISOString() : null,
  };
}

export function formatCourierShipment(
  shipments?: Array<{
    uuid: string | null;
    id: bigint;
    status: string;
    tracking_number: string | null;
    delivery_partners?: { name: string; code: string } | null;
    shipment_tracking?: Array<{
      status: string;
      location: string | null;
      note: string | null;
      tracked_at: Date;
    }>;
  }> | null
) {
  const shipment = shipments?.find((s) => s.delivery_partners && s.tracking_number);
  if (!shipment || !shipment.delivery_partners || !shipment.tracking_number) return null;

  return {
    id: shipment.uuid || String(shipment.id),
    carrier: shipment.delivery_partners.name,
    trackingNumber: shipment.tracking_number,
    trackingUrl:
      shipment.delivery_partners.code === INDIA_POST_PARTNER_CODE
        ? getIndiaPostTrackingUrl(shipment.tracking_number)
        : "",
    status: shipment.status,
    timeline: (shipment.shipment_tracking || []).map((t) => ({
      status: t.status,
      location: t.location,
      note: t.note,
      trackedAt: t.tracked_at,
    })),
  };
}

export function formatOrderDetail(
  order: Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>
): OrderDetailResponse {
  const customer = {
    id: order.user?.uuid || String(order.userId),
    customerId: order.user?.cust_id ?? null,
    name: order.user?.name || "",
    email: order.user?.email ?? null,
    phone: order.user?.phone ?? null,
  };

  const items = (order.items || []).map(formatOrderItem);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const shippingRaw = (order.address || []).find((a) => a.type === "shipping");
  const billingRaw = (order.address || []).find((a) => a.type === "billing");

  const shippingAddress = formatOrderAddress(shippingRaw);
  const billingAddress = formatOrderAddress(billingRaw || shippingRaw);

  const statusHistory = (order.order_status_history || []).map(
    formatOrderStatusHistory
  );

  const returnRequests = (order.return_requests || []).map(summarizeReturnRequest);
  const replacementRequests = (order.replacement_requests || []).map(
    summarizeReplacementRequest
  );
  const deliveredAt = resolveDeliveredAt(order);
  const { deliveredAt: windowDelivered, ...windowRest } = getReturnWindow(
    order.order_status,
    deliveredAt
  );

  return {
    id: order.uuid || String(order.id),
    orderNumber: order.orderNumber,
    customer,
    status: order.order_status,
    paymentStatus: order.payment_status,
    subtotal: Number(order.subtotal),
    discountAmount: Number(order.discountAmount),
    taxAmount: Number(order.taxAmount),
    shippingCharge: Number(order.shipping_charge),
    totalAmount: Number(order.totalAmount),
    totalItems,
    delivery: formatOrderDelivery((order as any).shipments),
    courierShipment: formatCourierShipment((order as any).shipments),
    notes: order.notes ?? null,
    placedAt: order.placed_at ?? null,
    deliveredAt,
    cancellation: formatCancellation(order),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items,
    shippingAddress,
    billingAddress,
    statusHistory,
    returnWindow: { ...windowRest, deliveredAt: windowDelivered },
    refunds: (order.refunds || []).map((r) => ({
      id: String(r.id),
      amount: Number(r.amount),
      status: r.status,
      processedAt: r.processed_at ?? null,
      createdAt: r.created_at,
    })),
    returnRequests,
    replacementRequests,
    timeline: buildOrderTimeline({
      orderStatus: order.order_status,
      placedAt: order.placed_at ?? order.createdAt,
      paymentStatus: order.payment_status,
      paymentConfirmedAt: order.payments?.[0]?.updatedAt ?? null,
      statusHistory: order.order_status_history || [],
      requests: [...returnRequests, ...replacementRequests],
    }),
  };
}

/** `delivered_at` is authoritative; older rows fall back to the delivery history entry. */
export function resolveDeliveredAt(order: {
  order_status: string;
  delivered_at?: Date | null;
  updatedAt: Date;
  order_status_history?: Array<{ status: string; created_at: Date }>;
}): Date | null {
  if (order.delivered_at) return order.delivered_at;
  if (order.order_status !== "delivered" && order.order_status !== "returned") return null;
  const row = (order.order_status_history || [])
    .filter((h) => h.status === "delivered")
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
  return row?.created_at ?? order.updatedAt;
}

function formatCancellation(order: {
  order_status: string;
  cancelled_at?: Date | null;
  cancellation_reason?: string | null;
  cancellation_comment?: string | null;
  cancelled_by?: string | null;
}) {
  if (order.order_status !== "cancelled") return null;
  return {
    cancelledAt: order.cancelled_at ?? null,
    reason: order.cancellation_reason ?? null,
    comment: order.cancellation_comment ?? null,
    cancelledBy: order.cancelled_by ?? null,
  };
}

export function formatOrderListItem(
  order: Prisma.OrderGetPayload<{
    include: {
      user: {
        select: {
          id: true;
          uuid: true;
          cust_id: true;
          name: true;
          email: true;
          phone: true;
        };
      };
      items: {
        where: { is_active: true };
        select: { quantity: true };
      };
    };
  }>
): OrderListItemResponse {
  const customer = {
    id: order.user?.uuid || String(order.userId),
    customerId: order.user?.cust_id ?? null,
    name: order.user?.name || "",
    email: order.user?.email ?? null,
    phone: order.user?.phone ?? null,
  };

  const totalItems = (order.items || []).reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return {
    id: order.uuid || String(order.id),
    orderNumber: order.orderNumber,
    customer,
    status: order.order_status,
    paymentStatus: order.payment_status,
    subtotal: Number(order.subtotal),
    discountAmount: Number(order.discountAmount),
    taxAmount: Number(order.taxAmount),
    shippingCharge: Number(order.shipping_charge),
    totalAmount: Number(order.totalAmount),
    totalItems,
    delivery: formatOrderDelivery((order as any).shipments),
    courierShipment: formatCourierShipment((order as any).shipments),
    notes: order.notes ?? null,
    placedAt: order.placed_at ?? null,
    deliveredAt: order.delivered_at ?? null,
    cancellation: formatCancellation(order),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function generateUniqueOrderNumber(
  prismaClient: Prisma.TransactionClient | typeof db = db
): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

  for (let i = 0; i < 10; i++) {
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    const orderNumber = `ORD-${dateStr}-${randomHex}`;

    const existing = await prismaClient.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    });

    if (!existing) {
      return orderNumber;
    }
  }

  // Fallback with timestamp
  return `ORD-${dateStr}-${Date.now().toString().slice(-6)}`;
}

export const orderRepository = {
  /** Referral/commission summary of one order (admin view). Null when the order has no agent. */
  async findOrderReferral(orderUuid: string): Promise<OrderReferralDto | null> {
    const order = await db.order.findFirst({
      where: { uuid: orderUuid },
      select: {
        referral_code: true,
        commission_percentage: true,
        commission_amount: true,
        agent: { select: { name: true, agent_profile: { select: { agent_code: true } } } },
        commissions: { select: { status: true, commission_amount: true, product_amount: true } },
      },
    });
    if (!order?.agent) return null;

    const statuses = new Set(order.commissions.map((c) => c.status));
    const total = order.commissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);
    const base = order.commissions.reduce((sum, c) => sum + Number(c.product_amount), 0);
    return {
      referralCode: order.referral_code,
      agentName: order.agent.name,
      agentCode: order.agent.agent_profile?.agent_code ?? null,
      commissionPercentage:
        order.commission_percentage != null
          ? Number(order.commission_percentage)
          : base > 0
            ? Math.round((total * 10000) / base) / 100
            : 0,
      commissionAmount: order.commission_amount != null ? Number(order.commission_amount) : Math.round(total * 100) / 100,
      commissionStatus: statuses.size === 0 ? "none" : statuses.size === 1 ? [...statuses][0] : "mixed",
    };
  },

  async createCustomerOrderTransaction(params: {
    userId: bigint;
    agentId?: bigint | null;
    referralCode?: string | null;
    cartId: bigint;
    subtotal: number;
    discountAmount?: number;
    shippingCharge?: number;
    totalAmount: number;
    notes?: string;
    orderStatus?: "pending" | "confirmed";
    paymentStatus?: "pending" | "paid";
    paymentMethod?: string;
    coupon?: { id: bigint; discountAmount: number };
    shippingAddress: {
      fullName: string;
      phone: string;
      addressLine1: string;
      addressLine2?: string | null;
      landmark?: string | null;
      city: string;
      state: string;
      pincode?: string | null;
      country?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    };
    billingAddress: {
      fullName: string;
      phone: string;
      addressLine1: string;
      addressLine2?: string | null;
      landmark?: string | null;
      city: string;
      state: string;
      pincode?: string | null;
      country?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    };
    items: Array<{
      productId: bigint;
      styleId: bigint;
      itemId: bigint | null;
      variantId: bigint;
      variantUnitPriceId: bigint;
      productName: string;
      itemName: string;
      attributes?: Array<{ name: string; value: string }>;
      variantName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      taxAmount: number;
      totalPrice: number;
    }>;
  }): Promise<OrderDetailResponse> {
    return db.$transaction(async (tx) => {
      const now = new Date();

      // 0. Claim the cart atomically. Two concurrent submits (double-click, two
      // tabs, retry) both read the same active cart; only the one that flips it
      // to "converted" may go on to create an order. The loser updates 0 rows.
      const claimedCart = await tx.cart.updateMany({
        where: { id: params.cartId, status: "active" },
        data: {
          status: "converted",
          last_activity_at: now,
          updatedAt: now,
          updated_by: params.userId,
        },
      });
      if (claimedCart.count !== 1) {
        throw ApiError.conflict(
          "This order has already been placed or your cart changed. Please check your orders."
        );
      }

      const orderNumber = await generateUniqueOrderNumber(tx);

      // 1. Create Order
      const createdOrder = await tx.order.create({
        data: {
          uuid: crypto.randomUUID(),
          orderNumber,
          userId: params.userId,
          agent_id: params.agentId ?? null,
          referral_code: params.agentId ? (params.referralCode ?? null) : null,
          cart_id: params.cartId,
          couponId: params.coupon?.id ?? null,
          order_status: (params.orderStatus ?? "pending") as any,
          payment_status: (params.paymentStatus ?? "pending") as any,
          subtotal: params.subtotal,
          discountAmount: params.discountAmount ?? 0,
          taxAmount: 0,
          shipping_charge: params.shippingCharge ?? 0,
          totalAmount: params.totalAmount,
          notes: params.notes ?? null,
          placed_at: now,
          is_active: true,
          created_by: params.userId,
          updated_by: params.userId,
        },
      });

      // Convert this cart's stock holds into confirmed holds against the
      // order, before the exact-quantity decrement below.
      await reservationService.confirmCart(tx, params.cartId, createdOrder.id);

      if (params.coupon) {
        await tx.coupon_usage.create({
          data: {
            coupon_id: params.coupon.id,
            user_id: params.userId,
            order_id: createdOrder.id,
            discount_amount: params.coupon.discountAmount,
          },
        });
      }

      // 2. Create Addresses (Shipping & Billing)
      await tx.orderAddress.createMany({
        data: [
          {
            uuid: crypto.randomUUID(),
            orderId: createdOrder.id,
            type: "shipping",
            full_name: params.shippingAddress.fullName,
            phone: params.shippingAddress.phone,
            address_line1: params.shippingAddress.addressLine1,
            address_line2: params.shippingAddress.addressLine2 ?? null,
            landmark: params.shippingAddress.landmark ?? null,
            city: params.shippingAddress.city,
            state: params.shippingAddress.state,
            pincode: params.shippingAddress.pincode || "",
            country: params.shippingAddress.country || "India",
            latitude: params.shippingAddress.latitude ?? null,
            longitude: params.shippingAddress.longitude ?? null,
            is_active: true,
            created_by: params.userId,
            updated_by: params.userId,
          },
          {
            uuid: crypto.randomUUID(),
            orderId: createdOrder.id,
            type: "billing",
            full_name: params.billingAddress.fullName,
            phone: params.billingAddress.phone,
            address_line1: params.billingAddress.addressLine1,
            address_line2: params.billingAddress.addressLine2 ?? null,
            landmark: params.billingAddress.landmark ?? null,
            city: params.billingAddress.city,
            state: params.billingAddress.state,
            pincode: params.billingAddress.pincode || "",
            country: params.billingAddress.country || "India",
            latitude: params.billingAddress.latitude ?? null,
            longitude: params.billingAddress.longitude ?? null,
            is_active: true,
            created_by: params.userId,
            updated_by: params.userId,
          },
        ],
      });

      // 3. Create Order Items
      await tx.orderItem.createMany({
        data: params.items.map((item) => ({
          uuid: crypto.randomUUID(),
          orderId: createdOrder.id,
          productId: item.productId,
          styleId: item.styleId,
          itemId: item.itemId,
          variantId: item.variantId,
          variantUnitPriceId: item.variantUnitPriceId,
          product_name_snapshot: item.productName,
          item_name_snapshot: item.itemName,
          variant_snapshot: item.variantName,
          attributes_snapshot: item.attributes ?? [],
          sku_snapshot: item.sku,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_amount: item.discountAmount,
          tax_amount: item.taxAmount,
          total_price: item.totalPrice,
          is_active: true,
          created_by: params.userId,
          updated_by: params.userId,
        })),
      });

      // 3.4. Agent commission rows (one per item) when the order is attributed to an agent.
      await createCommissionsForOrder(tx, createdOrder.id);

      // 3.5. Decrement stock for the exact variant+unit purchased, and log it.
      // A conditional updateMany (quantity_available >= requested) makes this
      // race-safe: if another order beat us to the last units, count is 0 and
      // we throw, rolling back the whole order transaction.
      for (const item of params.items) {
        await recordStockMovement(tx, {
          variantUnitPriceId: item.variantUnitPriceId,
          movementType: "SALE",
          direction: "out",
          quantity: item.quantity,
          referenceType: "order",
          referenceId: createdOrder.id,
          referenceNumber: orderNumber,
          reason: `Order ${orderNumber}`,
          actorId: params.userId,
          itemLabel: `${item.variantName} (SKU: ${item.sku})`,
        });
      }

      // 4. Create Status History
      await tx.order_status_history.create({
        data: {
          order_id: createdOrder.id,
          status: (params.orderStatus ?? "pending") as any,
          note:
            params.notes ||
            (params.paymentStatus === "paid"
              ? `Order confirmed with payment via ${params.paymentMethod ?? "CARD"}`
              : "Order placed by customer"),
          changed_by: params.userId,
          is_active: true,
          created_by: params.userId,
          updated_by: params.userId,
        },
      });

      // 5. Deactivate cart items (the cart itself was claimed in step 0)
      await tx.cartItem.updateMany({
        where: {
          cartId: params.cartId,
          is_active: true,
        },
        data: {
          is_active: false,
          updatedAt: now,
          updated_by: params.userId,
        },
      });

      // 6. Fetch created full order
      const fullOrder = await tx.order.findUniqueOrThrow({
        where: { id: createdOrder.id },
        include: orderDetailInclude,
      });

      return formatOrderDetail(fullOrder);
    });
  },

  async findCustomerOrders(
    userId: bigint,
    params: CustomerOrdersListInput | CustomerOrdersQueryInput = {}
  ): Promise<OrderListResponse<OrderDetailResponse>> {
    const page = Number(params.page ?? 1) || 1;
    const limit =
      Number((params as any).limit ?? params.pageSize ?? 20) || 20;

    const where: Prisma.OrderWhereInput = {
      userId,
      is_active: true,
    };

    // 1. Resolve requested status(es) flexibly (single string, array, or nested filters)
    const rawStatuses: string[] = [];
    const collectStatus = (val: unknown) => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach((v) => typeof v === "string" && rawStatuses.push(v));
      } else if (typeof val === "string") {
        rawStatuses.push(val);
      }
    };

    collectStatus(params.status);
    collectStatus((params as any).statuses);
    collectStatus((params as any).filters?.status);
    collectStatus((params as any).filters?.statuses);

    const validStatuses: any[] = [];
    for (const raw of rawStatuses) {
      const normalized = raw.trim().toLowerCase().replace(/\s+/g, "_");
      if (
        normalized === "order_placed" ||
        normalized === "orderplaced" ||
        normalized === "placed"
      ) {
        validStatuses.push("pending", "confirmed");
      } else if (
        normalized === "out_of_delivery" ||
        normalized === "out_for_delivery" ||
        normalized === "outfordelivery" ||
        normalized === "outdelivery"
      ) {
        validStatuses.push("out_for_delivery");
      } else if (
        [
          "pending",
          "confirmed",
          "processing",
          "packed",
          "shipped",
          "out_for_delivery",
          "delivered",
          "cancelled",
          "returned",
        ].includes(normalized)
      ) {
        validStatuses.push(normalized);
      }
    }

    if (validStatuses.length === 1) {
      where.order_status = validStatuses[0];
    } else if (validStatuses.length > 1) {
      where.order_status = { in: Array.from(new Set(validStatuses)) };
    }

    // 2. Resolve requested payment status(es)
    const rawPaymentStatuses: string[] = [];
    const collectPaymentStatus = (val: unknown) => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach((v) => typeof v === "string" && rawPaymentStatuses.push(v));
      } else if (typeof val === "string") {
        rawPaymentStatuses.push(val);
      }
    };

    collectPaymentStatus((params as any).paymentStatus);
    collectPaymentStatus((params as any).paymentStatuses);
    collectPaymentStatus((params as any).filters?.paymentStatus);
    collectPaymentStatus((params as any).filters?.paymentStatuses);

    const validPayments = rawPaymentStatuses
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is any =>
        ["pending", "paid", "failed", "refunded", "partial_refund"].includes(s)
      );

    if (validPayments.length === 1) {
      where.payment_status = validPayments[0];
    } else if (validPayments.length > 1) {
      where.payment_status = { in: Array.from(new Set(validPayments)) };
    }

    if (params.search) {
      where.orderNumber = { contains: params.search };
    }

    const sortOrder =
      String(params.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    let orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: sortOrder };

    if (params.sortBy === "orderNumber") {
      orderBy = { orderNumber: sortOrder };
    } else if (params.sortBy === "createdAt") {
      orderBy = { createdAt: sortOrder };
    } else if (params.sortBy === "updatedAt") {
      orderBy = { updatedAt: sortOrder };
    } else if (params.sortBy === "placedAt") {
      orderBy = { placed_at: sortOrder };
    } else if (params.sortBy === "totalAmount") {
      orderBy = { totalAmount: sortOrder };
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: orderDetailInclude,
      }),
      db.order.count({ where }),
    ]);

    return {
      data: orders.map(formatOrderDetail),
      meta: {
        page,
        limit,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findCustomerOrderByUuid(
    userId: bigint,
    uuid: string
  ): Promise<OrderDetailResponse | null> {
    if (!uuid || uuid === "undefined" || uuid === "null") {
      return null;
    }

    const isNumeric = /^\d+$/.test(uuid);
    const order = await db.order.findFirst({
      where: {
        userId,
        is_active: true,
        OR: [
          { uuid },
          { orderNumber: uuid },
          ...(isNumeric ? [{ id: BigInt(uuid) }] : []),
        ],
      },
      include: orderDetailInclude,
    });

    return order ? formatOrderDetail(order) : null;
  },

  buildAdminOrdersWhere(params: AdminOrdersListInput): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      is_active: true,
    };

    if (params.customerId) {
      where.user = { uuid: params.customerId };
    }

    if (params.status) {
      where.order_status = params.status;
    }

    if (params.paymentStatus) {
      where.payment_status = params.paymentStatus;
    }

    if (params.search) {
      const s = params.search;
      where.OR = [
        { orderNumber: { contains: s } },
        { user: { name: { contains: s } } },
        { user: { email: { contains: s } } },
        { user: { phone: { contains: s } } },
        { user: { cust_id: { contains: s } } },
      ];
    }

    return where;
  },

  async countAdminOrders(
    params: AdminOrdersListInput
  ): Promise<AdminOrdersCountResponse> {
    const baseWhere: Prisma.OrderWhereInput = {
      is_active: true,
    };

    if (params.customerId) {
      baseWhere.user = { uuid: params.customerId };
    }

    if (params.paymentStatus) {
      baseWhere.payment_status = params.paymentStatus;
    }

    if (params.search) {
      const s = params.search;
      baseWhere.OR = [
        { orderNumber: { contains: s } },
        { user: { name: { contains: s } } },
        { user: { email: { contains: s } } },
        { user: { phone: { contains: s } } },
        { user: { cust_id: { contains: s } } },
      ];
    }

    const whereToUse = params.status
      ? { ...baseWhere, order_status: params.status }
      : baseWhere;

    const grouped = await db.order.groupBy({
      by: ["order_status"],
      where: whereToUse,
      _count: {
        id: true,
      },
    });

    const statusCounts: AdminOrdersCountResponse = {
      pending: 0,
      confirmed: 0,
      processing: 0,
      packed: 0,
      shipped: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
      total: 0,
    };

    for (const g of grouped) {
      const status = g.order_status as keyof AdminOrdersCountResponse;
      if (status && status in statusCounts && status !== "total") {
        statusCounts[status] = g._count.id;
        statusCounts.total += g._count.id;
      }
    }

    return statusCounts;
  },

  async findAdminOrders(
    params: AdminOrdersListInput
  ): Promise<OrderListResponse<OrderListItemResponse>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where = this.buildAdminOrdersWhere(params);

    const sortOrder = params.sortOrder ?? "desc";
    let orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: sortOrder };

    if (params.sortBy === "orderNumber") {
      orderBy = { orderNumber: sortOrder };
    } else if (params.sortBy === "createdAt") {
      orderBy = { createdAt: sortOrder };
    } else if (params.sortBy === "updatedAt") {
      orderBy = { updatedAt: sortOrder };
    } else if (params.sortBy === "placedAt") {
      orderBy = { placed_at: sortOrder };
    } else if (params.sortBy === "totalAmount") {
      orderBy = { totalAmount: sortOrder };
    } else if (params.sortBy === "orderStatus") {
      orderBy = { order_status: sortOrder };
    } else if (params.sortBy === "paymentStatus") {
      orderBy = { payment_status: sortOrder };
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              uuid: true,
              cust_id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          items: {
            where: { is_active: true },
            select: { quantity: true },
          },
          shipments: {
            where: { is_active: true },
            orderBy: { id: "desc" },
            take: 1,
            include: {
              delivery_staff: {
                select: {
                  id: true,
                  uuid: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      }),
      db.order.count({ where }),
    ]);

    return {
      data: orders.map(formatOrderListItem),
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async findAdminOrderByUuid(uuid: string): Promise<OrderDetailResponse | null> {
    const order = await db.order.findFirst({
      where: {
        uuid,
        is_active: true,
      },
      include: orderDetailInclude,
    });

    return order ? formatOrderDetail(order) : null;
  },

  async cancelOrderTransaction(params: {
    orderId: bigint;
    note?: string;
    reason: string;
    comment?: string | null;
    cancelledBy: "USER" | "ADMIN" | "SYSTEM";
    changedBy: bigint;
    /** Statuses the order may still be in; guards against concurrent transitions. */
    allowedStatuses: string[];
  }): Promise<OrderDetailResponse> {
    return db.$transaction(async (tx) => {
      const now = new Date();

      // Conditional update = atomic claim: a second concurrent cancel (or a
      // ship/deliver that raced us) updates 0 rows and aborts before restocking.
      const claimed = await tx.order.updateMany({
        where: {
          id: params.orderId,
          order_status: { in: params.allowedStatuses as any[] },
        },
        data: {
          order_status: "cancelled",
          cancelled_at: now,
          cancellation_reason: params.reason.slice(0, 100),
          cancellation_comment: params.comment?.trim() ? params.comment.trim().slice(0, 500) : null,
          cancelled_by: params.cancelledBy,
          cancelled_by_user_id: params.changedBy,
          updatedAt: now,
          updated_by: params.changedBy,
        },
      });
      if (claimed.count !== 1) {
        throw ApiError.conflict("This order can no longer be cancelled.");
      }

      const items = await tx.orderItem.findMany({
        where: { orderId: params.orderId, is_active: true, variantUnitPriceId: { not: null } },
        select: { variantUnitPriceId: true, quantity: true },
      });

      const cancelledOrder = await tx.order.findUnique({
        where: { id: params.orderId },
        select: { orderNumber: true },
      });
      for (const item of items) {
        await recordStockMovement(tx, {
          variantUnitPriceId: item.variantUnitPriceId!,
          movementType: "RETURN",
          direction: "in",
          quantity: item.quantity,
          referenceType: "order_cancel",
          referenceId: params.orderId,
          referenceNumber: cancelledOrder?.orderNumber,
          reason: params.note || "Order cancelled",
          actorId: params.changedBy,
        });
      }

      await syncCommissionsWithOrderStatus(tx, params.orderId, "cancelled", { id: params.changedBy, role: "USER" });

      // Money already collected online is owed back: track it as a refund
      // (settled through the gateway by the admin, like return refunds).
      const order = await tx.order.findUniqueOrThrow({
        where: { id: params.orderId },
        select: { payment_status: true, totalAmount: true },
      });
      if (order.payment_status === "paid") {
        const payment = await tx.payment.findFirst({
          where: { orderId: params.orderId, status: "success", gateway: { not: null } },
          orderBy: { id: "asc" },
        });
        const existingRefund = payment
          ? await tx.refunds.findFirst({ where: { order_id: params.orderId, payment_id: payment.id } })
          : null;
        if (payment && !existingRefund) {
          await tx.refunds.create({
            data: {
              payment_id: payment.id,
              order_id: params.orderId,
              amount: payment.amount,
              reason: "Order cancelled",
              status: "initiated",
              created_by: params.changedBy,
              updated_by: params.changedBy,
            },
          });
        }
      }

      await tx.order_status_history.create({
        data: {
          order_id: params.orderId,
          status: "cancelled",
          note: (
            params.note ||
            [params.reason, params.comment?.trim()].filter(Boolean).join(" - ") ||
            "Order cancelled"
          ).slice(0, 255),
          changed_by: params.changedBy,
          is_active: true,
          created_by: params.changedBy,
          updated_by: params.changedBy,
        },
      });

      const updated = await tx.order.findUniqueOrThrow({
        where: { id: params.orderId },
        include: orderDetailInclude,
      });

      return formatOrderDetail(updated);
    });
  },

  async returnOrderTransaction(params: {
    orderId: bigint;
    note?: string;
    changedBy: bigint;
  }): Promise<OrderDetailResponse> {
    return db.$transaction(async (tx) => {
      const now = new Date();

      const orderItems = await tx.orderItem.findMany({
        where: { orderId: params.orderId, is_active: true, variantUnitPriceId: { not: null } },
        select: { id: true, variantUnitPriceId: true, quantity: true },
      });
      // Units already put back on the shelf through an item-level return request
      // must not be restocked a second time.
      const alreadyBack = await tx.return_items.groupBy({
        by: ["order_item_id"],
        where: {
          is_active: true,
          order_item_id: { in: orderItems.map((i) => i.id) },
          return_requests: {
            is_active: true,
            rejected_at: null,
            status: { in: ["received", "refund_pending", "refunded", "closed"] },
          },
        },
        _sum: { quantity: true },
      });
      const backByItem = new Map(alreadyBack.map((r) => [String(r.order_item_id), r._sum.quantity ?? 0]));
      const items = orderItems
        .map((i) => ({
          variantUnitPriceId: i.variantUnitPriceId,
          quantity: i.quantity - (backByItem.get(String(i.id)) ?? 0),
        }))
        .filter((i) => i.quantity > 0);

      const returnedOrder = await tx.order.findUnique({
        where: { id: params.orderId },
        select: { orderNumber: true },
      });
      for (const item of items) {
        await recordStockMovement(tx, {
          variantUnitPriceId: item.variantUnitPriceId!,
          movementType: "RETURN",
          direction: "in",
          quantity: item.quantity,
          referenceType: "order_return",
          referenceId: params.orderId,
          referenceNumber: returnedOrder?.orderNumber,
          reason: params.note || "Order returned",
          actorId: params.changedBy,
        });
      }

      await tx.order.update({
        where: { id: params.orderId },
        data: {
          order_status: "returned",
          updatedAt: now,
          updated_by: params.changedBy,
        },
      });
      await syncCommissionsWithOrderStatus(tx, params.orderId, "returned", { id: params.changedBy, role: "USER" });

      await tx.order_status_history.create({
        data: {
          order_id: params.orderId,
          status: "returned",
          note: params.note || "Order returned",
          changed_by: params.changedBy,
          is_active: true,
          created_by: params.changedBy,
          updated_by: params.changedBy,
        },
      });

      const updated = await tx.order.findUniqueOrThrow({
        where: { id: params.orderId },
        include: orderDetailInclude,
      });

      return formatOrderDetail(updated);
    });
  },

  async updateOrderStatusWithHistory(params: {
    orderId: bigint;
    status: string;
    note?: string;
    changedBy: bigint;
    /** When set, the update only applies if the order is still in this status. */
    expectedStatus?: string;
  }): Promise<OrderDetailResponse> {
    return db.$transaction(async (tx) => {
      const now = new Date();

      // Conditional update = atomic claim: a concurrent transition that got
      // there first updates 0 rows here, before any history/commission write.
      const claimed = await tx.order.updateMany({
        where: {
          id: params.orderId,
          ...(params.expectedStatus
            ? { order_status: params.expectedStatus as any }
            : {}),
        },
        data: {
          order_status: params.status as any,
          ...(params.status === "delivered" ? { delivered_at: now } : {}),
          updatedAt: now,
          updated_by: params.changedBy,
        },
      });
      if (claimed.count !== 1) {
        throw ApiError.conflict(
          "Order status has changed. Please refresh and try again."
        );
      }
      await syncCommissionsWithOrderStatus(tx, params.orderId, params.status, { id: params.changedBy, role: "USER" });

      await tx.order_status_history.create({
        data: {
          order_id: params.orderId,
          status: params.status,
          note: params.note || null,
          changed_by: params.changedBy,
          is_active: true,
          created_by: params.changedBy,
          updated_by: params.changedBy,
        },
      });

      const updated = await tx.order.findUniqueOrThrow({
        where: { id: params.orderId },
        include: orderDetailInclude,
      });

      return formatOrderDetail(updated);
    });
  },
};
