import { Prisma } from "@/generated/prisma";

/** Order item fields needed to describe a returned / replaced line. */
export const requestOrderItemSelect = {
  select: {
    id: true,
    uuid: true,
    orderId: true,
    variantId: true,
    variantUnitPriceId: true,
    product_name_snapshot: true,
    variant_snapshot: true,
    attributes_snapshot: true,
    sku_snapshot: true,
    quantity: true,
    unit_price: true,
    total_price: true,
    product: {
      select: {
        images: {
          where: { is_active: true },
          orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
          take: 1,
        },
      },
    },
    style: {
      select: {
        images: {
          where: { is_active: true },
          orderBy: [{ is_primary: "desc" as const }, { sort_order: "asc" as const }],
          take: 1,
        },
      },
    },
    variant_unit_price: {
      select: { attribute_value: { select: { value: true } } },
    },
    variant: {
      select: {
        color_name: true,
        product_variant_images: {
          where: { is_active: true },
          orderBy: [{ is_primary: "desc" as const }, { sort_order: "asc" as const }],
          take: 1,
        },
      },
    },
  },
};

export const returnRequestInclude = Prisma.validator<Prisma.return_requestsInclude>()({
  return_items: {
    where: { is_active: true },
    include: { order_items: requestOrderItemSelect },
  },
  history: { orderBy: [{ created_at: "asc" }, { id: "asc" }] },
});

export const replacementRequestInclude =
  Prisma.validator<Prisma.replacement_requestsInclude>()({
    items: {
      where: { is_active: true },
      include: {
        order_items: requestOrderItemSelect,
        requested_variant_unit_price: {
          select: {
            id: true,
            uuid: true,
            attribute_value: { select: { value: true } },
          },
        },
      },
    },
    history: { orderBy: [{ created_at: "asc" }, { id: "asc" }] },
  });

/** Admin-facing includes add the customer and order context. */
export const adminReturnInclude = Prisma.validator<Prisma.return_requestsInclude>()({
  ...returnRequestInclude,
  orders: {
    select: {
      id: true,
      uuid: true,
      orderNumber: true,
      order_status: true,
      payment_status: true,
      totalAmount: true,
      delivered_at: true,
      updatedAt: true,
      placed_at: true,
      createdAt: true,
    },
  },
  users_return_requests_user_idTousers: {
    select: { id: true, uuid: true, name: true, email: true, phone: true },
  },
});

export const adminReplacementInclude =
  Prisma.validator<Prisma.replacement_requestsInclude>()({
    ...replacementRequestInclude,
    orders: {
      select: {
        id: true,
        uuid: true,
        orderNumber: true,
        order_status: true,
        payment_status: true,
        totalAmount: true,
        delivered_at: true,
        updatedAt: true,
        placed_at: true,
        createdAt: true,
      },
    },
    user: {
      select: { id: true, uuid: true, name: true, email: true, phone: true },
    },
  });
