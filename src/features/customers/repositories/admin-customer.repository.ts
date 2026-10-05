import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { formatVariantMeasurement } from "@/features/variants/utils/measurement.util";
import type {
  AdminCustomerListInput,
  AdminCustomerOrdersInput,
} from "../validations/admin-customer.schema";
import type {
  AdminCustomerListItemDto,
  AdminCustomerListResponse,
  AdminCustomerDetailDto,
  AdminCustomerAddressDto,
  AdminCustomerOrderItemDto,
  AdminCustomerOrdersResponse,
  AdminCustomerCartDto,
  AdminCustomerCartItemDto,
  AdminCustomersCountResponse,
} from "../types/admin-customer.types";

const adminCustomerInclude = Prisma.validator<Prisma.customer_profilesInclude>()({
  users_customer_profiles_user_idTousers: {
    select: {
      id: true,
      uuid: true,
      cust_id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      status: true,
      is_active: true,
      is_blocked: true,
      block_reason: true,
      blocked_at: true,
      email_verified_at: true,
      phone_verified_at: true,
      last_login_at: true,
      createdAt: true,
      updatedAt: true,
    },
  },
});

export function formatAdminCustomer(
  profile: Prisma.customer_profilesGetPayload<{
    include: typeof adminCustomerInclude;
  }>
): AdminCustomerListItemDto {
  const user = profile.users_customer_profiles_user_idTousers;
  const profileUuid = profile.uuid || String(profile.id);
  const userUuid = user.uuid || String(user.id);

  let formattedDob: string | null = null;
  if (profile.dob) {
    formattedDob = profile.dob.toISOString().split("T")[0];
  }

  const isBlocked = user.is_blocked !== null && Number(user.is_blocked) > 0;
  const profileImage = profile.profile_image || user.avatar || null;

  return {
    id: profileUuid,
    userId: userUuid,
    customerId: user.cust_id ?? null,
    name: profile.name || user.name || "",
    email: profile.email || user.email || "",
    phone: profile.phone || user.phone || "",
    profileImage,
    isWhatsapp: Boolean(profile.is_whatsapp),
    whatsappNo: profile.whatsapp_no ?? null,
    dob: formattedDob,
    gender: profile.gender ?? null,
    referralCode: profile.referral_code ?? null,
    status: user.status,
    isActive: Boolean(user.is_active),
    isBlocked,
    blockReason: isBlocked ? user.block_reason ?? null : null,
    blockedAt: isBlocked ? user.blocked_at ?? null : null,
    emailVerified: user.email_verified_at !== null,
    phoneVerified: user.phone_verified_at !== null,
    lastLoginAt: user.last_login_at ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const adminCustomerRepository = {
  buildAdminCustomerWhere(
    params: AdminCustomerListInput
  ): Prisma.customer_profilesWhereInput {
    const userWhere: Prisma.UserWhereInput = {
      deleted_at: null,
      role: {
        slug: "customer",
      },
    };

    if (params.status) {
      userWhere.status = params.status;
    }

    if (typeof params.isActive === "boolean") {
      userWhere.is_active = params.isActive;
    }

    if (params.isBlocked !== undefined) {
      if (params.isBlocked) {
        userWhere.is_blocked = { not: null, gt: 0 };
      } else {
        userWhere.OR = [{ is_blocked: null }, { is_blocked: 0 }];
      }
    }

    if (params.emailVerified !== undefined) {
      userWhere.email_verified_at = params.emailVerified ? { not: null } : null;
    }

    if (params.phoneVerified !== undefined) {
      userWhere.phone_verified_at = params.phoneVerified ? { not: null } : null;
    }

    const where: Prisma.customer_profilesWhereInput = {
      users_customer_profiles_user_idTousers: userWhere,
    };

    if (typeof params.isActive === "boolean") {
      where.is_active = params.isActive;
    }

    if (params.gender) {
      where.gender = params.gender;
    }

    if (params.isWhatsapp !== undefined) {
      where.is_whatsapp = params.isWhatsapp;
    }

    if (params.search) {
      const s = params.search;
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            { name: { contains: s } },
            { email: { contains: s } },
            { phone: { contains: s } },
            { whatsapp_no: { contains: s } },
            { referral_code: { contains: s } },
            { users_customer_profiles_user_idTousers: { name: { contains: s } } },
            { users_customer_profiles_user_idTousers: { email: { contains: s } } },
            { users_customer_profiles_user_idTousers: { phone: { contains: s } } },
            { users_customer_profiles_user_idTousers: { cust_id: { contains: s } } },
          ],
        },
      ];
    }

    return where;
  },

  async countAdminCustomers(
    params: AdminCustomerListInput
  ): Promise<AdminCustomersCountResponse> {
    const baseUserWhere: Prisma.UserWhereInput = {
      deleted_at: null,
      role: {
        slug: "customer",
      },
    };

    const baseWhere: Prisma.customer_profilesWhereInput = {
      users_customer_profiles_user_idTousers: baseUserWhere,
    };

    if (params.search) {
      const s = params.search;
      baseWhere.AND = [
        {
          OR: [
            { name: { contains: s } },
            { email: { contains: s } },
            { phone: { contains: s } },
            { whatsapp_no: { contains: s } },
            { referral_code: { contains: s } },
            { users_customer_profiles_user_idTousers: { name: { contains: s } } },
            { users_customer_profiles_user_idTousers: { email: { contains: s } } },
            { users_customer_profiles_user_idTousers: { phone: { contains: s } } },
            { users_customer_profiles_user_idTousers: { cust_id: { contains: s } } },
          ],
        },
      ];
    }

    const [
      active,
      inactive,
      blocked,
      unblocked,
      verified,
      unverified,
      male,
      female,
      other,
      all,
    ] = await Promise.all([
      db.customer_profiles.count({
        where: {
          ...baseWhere,
          is_active: true,
          users_customer_profiles_user_idTousers: {
            ...baseUserWhere,
            is_active: true,
          },
        },
      }),
      db.customer_profiles.count({
        where: {
          ...baseWhere,
          OR: [
            { is_active: false },
            {
              users_customer_profiles_user_idTousers: {
                ...baseUserWhere,
                is_active: false,
              },
            },
          ],
        },
      }),
      db.customer_profiles.count({
        where: {
          ...baseWhere,
          users_customer_profiles_user_idTousers: {
            ...baseUserWhere,
            is_blocked: { not: null, gt: 0 },
          },
        },
      }),
      db.customer_profiles.count({
        where: {
          ...baseWhere,
          users_customer_profiles_user_idTousers: {
            ...baseUserWhere,
            OR: [{ is_blocked: null }, { is_blocked: 0 }],
          },
        },
      }),
      db.customer_profiles.count({
        where: {
          ...baseWhere,
          users_customer_profiles_user_idTousers: {
            ...baseUserWhere,
            OR: [
              { email_verified_at: { not: null } },
              { phone_verified_at: { not: null } },
            ],
          },
        },
      }),
      db.customer_profiles.count({
        where: {
          ...baseWhere,
          users_customer_profiles_user_idTousers: {
            ...baseUserWhere,
            email_verified_at: null,
            phone_verified_at: null,
          },
        },
      }),
      db.customer_profiles.count({
        where: {
          ...baseWhere,
          gender: "male",
        },
      }),
      db.customer_profiles.count({
        where: {
          ...baseWhere,
          gender: "female",
        },
      }),
      db.customer_profiles.count({
        where: {
          ...baseWhere,
          OR: [{ gender: "other" }, { gender: null }],
        },
      }),
      db.customer_profiles.count({
        where: baseWhere,
      }),
    ]);

    return {
      active,
      inactive,
      blocked,
      unblocked,
      verified,
      unverified,
      male,
      female,
      other,
      all,
    };
  },

  async findAdminCustomers(
    params: AdminCustomerListInput
  ): Promise<AdminCustomerListResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where = this.buildAdminCustomerWhere(params);

    const sortOrder = params.sortOrder ?? "desc";
    let orderBy: Prisma.customer_profilesOrderByWithRelationInput = {
      users_customer_profiles_user_idTousers: { createdAt: sortOrder },
    };

    if (params.sortBy === "name") {
      orderBy = { users_customer_profiles_user_idTousers: { name: sortOrder } };
    } else if (params.sortBy === "email") {
      orderBy = { users_customer_profiles_user_idTousers: { email: sortOrder } };
    } else if (params.sortBy === "createdAt") {
      orderBy = { users_customer_profiles_user_idTousers: { createdAt: sortOrder } };
    } else if (params.sortBy === "updatedAt") {
      orderBy = { users_customer_profiles_user_idTousers: { updatedAt: sortOrder } };
    } else if (params.sortBy === "lastLoginAt") {
      orderBy = { users_customer_profiles_user_idTousers: { last_login_at: sortOrder } };
    } else if (params.sortBy === "status") {
      orderBy = { users_customer_profiles_user_idTousers: { status: sortOrder } };
    }

    const [profiles, total] = await Promise.all([
      db.customer_profiles.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: adminCustomerInclude,
      }),
      db.customer_profiles.count({ where }),
    ]);

    const data = profiles.map((p) => formatAdminCustomer(p));

    return {
      data,
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async findCustomerUserByUuid(uuid: string) {
    return db.user.findFirst({
      where: {
        OR: [
          { uuid },
          { customer_profiles_customer_profiles_user_idTousers: { uuid } },
        ],
        deleted_at: null,
        role: {
          slug: "customer",
        },
      },
      include: {
        role: true,
        customer_profiles_customer_profiles_user_idTousers: true,
      },
    });
  },

  async updateCustomerStatus(
    uuid: string,
    isActive: boolean,
    adminUserId?: bigint | number,
    blockReason?: string
  ): Promise<AdminCustomerDetailDto | null> {
    const user = await this.findCustomerUserByUuid(uuid);
    if (!user) return null;

    const newStatus = isActive ? "active" : "inactive";
    const isBlocked = isActive ? 0 : 1;
    const blockedAt = isActive ? null : new Date();

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          is_active: isActive,
          status: newStatus,
          is_blocked: isBlocked,
          blocked_at: blockedAt,
          block_reason: isActive ? null : blockReason ?? null,
          updatedAt: new Date(),
          ...(adminUserId ? { updated_by: BigInt(adminUserId) } : {}),
        },
      });

      if (user.customer_profiles_customer_profiles_user_idTousers) {
        await tx.customer_profiles.update({
          where: { id: user.customer_profiles_customer_profiles_user_idTousers.id },
          data: {
            is_active: isActive,
            status: isActive,
            updated_at: new Date(),
            ...(adminUserId ? { updated_by: BigInt(adminUserId) } : {}),
          },
        });
      }
    });

    return this.findCustomerByUuid(uuid);
  },

  async findCustomerByUuid(uuid: string): Promise<AdminCustomerDetailDto | null> {
    const user = await this.findCustomerUserByUuid(uuid);
    if (!user) return null;

    const profile = user.customer_profiles_customer_profiles_user_idTousers;
    const isBlocked = user.is_blocked !== null && Number(user.is_blocked) > 0;
    const profileImage = profile?.profile_image || user.avatar || null;

    let formattedDob: string | null = null;
    if (profile?.dob) {
      formattedDob = profile.dob.toISOString().split("T")[0];
    }

    return {
      id: user.uuid || String(user.id),
      customerId: user.cust_id ?? null,
      name: profile?.name || user.name || "",
      email: profile?.email || user.email || null,
      phone: profile?.phone || user.phone || null,
      profileImage,
      dob: formattedDob,
      gender: profile?.gender ?? null,
      isWhatsapp: Boolean(profile?.is_whatsapp),
      whatsappNo: profile?.whatsapp_no ?? null,
      referralCode: profile?.referral_code ?? null,
      status: user.status,
      isActive: Boolean(user.is_active),
      isBlocked,
      blockReason: isBlocked ? user.block_reason ?? null : null,
      blockedAt: isBlocked ? user.blocked_at ?? null : null,
      emailVerified: user.email_verified_at !== null,
      phoneVerified: user.phone_verified_at !== null,
      lastLoginAt: user.last_login_at ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },

  async findCustomerAddressesByCustomerUuid(
    uuid: string
  ): Promise<AdminCustomerAddressDto[] | null> {
    const user = await this.findCustomerUserByUuid(uuid);
    if (!user) return null;

    const addresses = await db.customerAddress.findMany({
      where: {
        userId: user.id,
        is_active: true,
        deleted_at: null,
      },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return addresses.map((addr) => ({
      id: addr.uuid || String(addr.id),
      type: addr.label || "home",
      addressType: addr.addressType === "billing" ? "billing" : "shipping",
      fullName: addr.full_name,
      phone: addr.phone,
      addressLine1: addr.address_line1,
      addressLine2: addr.address_line2 ?? null,
      landmark: addr.landmark ?? null,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode ?? "",
      country: addr.country,
      latitude:
        addr.latitude !== null && addr.latitude !== undefined
          ? Number(addr.latitude)
          : null,
      longitude:
        addr.longitude !== null && addr.longitude !== undefined
          ? Number(addr.longitude)
          : null,
      isDefault: Boolean(addr.isDefault),
      createdAt: addr.createdAt,
      updatedAt: addr.updatedAt,
    }));
  },

  async findCustomerOrdersByCustomerUuid(
    uuid: string,
    params: AdminCustomerOrdersInput
  ): Promise<AdminCustomerOrdersResponse | null> {
    const user = await this.findCustomerUserByUuid(uuid);
    if (!user) return null;

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where: Prisma.OrderWhereInput = {
      userId: user.id,
      is_active: true,
    };

    if (params.status) {
      where.order_status = params.status;
    }

    if (params.paymentStatus) {
      where.payment_status = params.paymentStatus;
    }

    if (params.search) {
      where.orderNumber = { contains: params.search };
    }

    const sortOrder = params.sortOrder ?? "desc";
    let orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: sortOrder };

    if (params.sortBy === "orderNumber") {
      orderBy = { orderNumber: sortOrder };
    } else if (params.sortBy === "status") {
      orderBy = { order_status: sortOrder };
    } else if (params.sortBy === "totalAmount") {
      orderBy = { totalAmount: sortOrder };
    } else if (params.sortBy === "placedAt") {
      orderBy = { placed_at: sortOrder };
    } else if (params.sortBy === "createdAt") {
      orderBy = { createdAt: sortOrder };
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: {
            where: { is_active: true },
            select: { quantity: true },
          },
        },
      }),
      db.order.count({ where }),
    ]);

    const data: AdminCustomerOrderItemDto[] = orders.map((order) => {
      const totalItems = (order.items || []).reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      return {
        id: order.uuid || String(order.id),
        orderNumber: order.orderNumber,
        status: order.order_status,
        paymentStatus: order.payment_status,
        totalAmount: Number(order.totalAmount),
        totalItems,
        placedAt: order.placed_at ?? null,
        createdAt: order.createdAt,
      };
    });

    return {
      data,
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async findCustomerActiveCartByCustomerUuid(
    uuid: string
  ): Promise<AdminCustomerCartDto | null | undefined> {
    const user = await this.findCustomerUserByUuid(uuid);
    if (!user) return undefined;

    const cart = await db.cart.findFirst({
      where: {
        userId: user.id,
        status: "active",
        is_active: true,
      },
      include: {
        items: {
          where: {
            is_active: true,
            variant_unit_price: {
              isActive: true,
              deleted_at: null,
              variant: {
                isActive: true,
                deleted_at: null,
              },
            },
            product: {
              isActive: true,
              deleted_at: null,
            },
          },
          include: {
            product: {
              select: {
                id: true,
                uuid: true,
                name: true,
                images: {
                  where: { is_active: true },
                  orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                  take: 1,
                  select: { image_url: true },
                },
              },
            },
            variant_unit_price: {
              select: {
                id: true,
                uuid: true,
                sku: true,
                base_price: true,
                unit_value: true,
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
                    product_variant_images: {
                      where: { is_active: true },
                      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                      take: 1,
                      select: { image_url: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!cart) return null;

    let subtotal = 0;
    let totalItems = 0;

    const items: AdminCustomerCartItemDto[] = [];

    for (const item of cart.items) {
      const unitPrice = item.variant_unit_price;
      const variant = unitPrice?.variant;
      if (!unitPrice || !variant || !item.product || !item.is_active) continue;

      const basePrice =
        unitPrice.base_price !== null && unitPrice.base_price !== undefined
          ? Number(unitPrice.base_price)
          : 0;
      const displayUnitPrice = basePrice;
      const totalPrice = item.quantity * displayUnitPrice;

      subtotal += totalPrice;
      totalItems += item.quantity;

      const primaryImage =
        variant.product_variant_images?.[0]?.image_url ||
        item.product.images?.[0]?.image_url ||
        null;

      const measurement = formatVariantMeasurement(
        unitPrice.product_units,
        unitPrice.unit_value ?? 0
      );

      items.push({
        id: item.uuid || String(item.id),
        productId: item.product.uuid || String(item.product.id),
        productName: item.product.name,
        variantId: variant.uuid || String(variant.id),
        variantName: variant.variant_name,
        sku: unitPrice.sku ?? "",
        measurement,
        primaryImage,
        quantity: item.quantity,
        unitPrice: displayUnitPrice,
        totalPrice,
      });
    }

    return {
      id: cart.uuid || String(cart.id),
      status: cart.status,
      totalItems,
      subtotal,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      items,
    };
  },
};
