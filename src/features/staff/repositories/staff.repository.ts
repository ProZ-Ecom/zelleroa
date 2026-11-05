import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import type { GetStaffParams, AdminStaffCountResponse } from "../types";

const staffInclude = Prisma.validator<Prisma.UserInclude>()({
  role: {
    select: {
      id: true,
      name: true,
      slug: true,
      scope: true,
    },
  },
});

/** Role slugs that belong to the store owners, not to the staff list. */
const OWNER_ROLE_SLUGS = ["admin", "super-admin", "super_admin"];

/**
 * A staff member is any back-office user (role scope ADMIN) other than the owners —
 * so roles an admin created themselves, e.g. "Warehouse Manager", count as staff.
 */
export const STAFF_ROLE_FILTER: Prisma.RoleWhereInput = {
  scope: "ADMIN",
  slug: { notIn: OWNER_ROLE_SLUGS },
};

export const staffRepository = {
  async getStaffRole() {
    return db.role.findFirst({
      where: { slug: "staff", is_active: true },
    });
  },

  /** The role to put a new/edited staff member in, when the admin picked one explicitly. */
  async findAssignableStaffRole(roleId: number | bigint) {
    return db.role.findFirst({
      where: { id: BigInt(roleId), is_active: true, ...STAFF_ROLE_FILTER },
    });
  },

  /** Every role a staff member may be given, for the role picker on the Staff screen. */
  async findAssignableStaffRoles() {
    return db.role.findMany({
      where: { is_active: true, ...STAFF_ROLE_FILTER },
      select: { id: true, name: true, slug: true, description: true },
      orderBy: { name: "asc" },
    });
  },

  async findStaffByUuid(uuid: string) {
    return db.user.findFirst({
      where: {
        uuid,
        role: STAFF_ROLE_FILTER,
        deleted_at: null,
      },
      include: staffInclude,
    });
  },

  async findStaffById(id: number | bigint) {
    return db.user.findFirst({
      where: {
        id: BigInt(id),
        role: STAFF_ROLE_FILTER,
        deleted_at: null,
      },
      include: staffInclude,
    });
  },

  async findByEmail(email: string, excludeUuid?: string) {
    return db.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findByPhone(phone: string, excludeUuid?: string) {
    return db.user.findFirst({
      where: {
        phone,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  buildStaffWhere(params: GetStaffParams = {}): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {
      role: STAFF_ROLE_FILTER,
      deleted_at: null,
    };

    if (typeof params.isActive === "boolean") {
      where.is_active = params.isActive;
    }

    if (params.search) {
      const search = params.search.trim();
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    return where;
  },

  async countStaff(
    params: GetStaffParams = {}
  ): Promise<AdminStaffCountResponse> {
    const baseWhere: Prisma.UserWhereInput = {
      role: STAFF_ROLE_FILTER,
      deleted_at: null,
    };

    if (params.search) {
      const search = params.search.trim();
      baseWhere.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [active, inactive, all] = await Promise.all([
      db.user.count({ where: { ...baseWhere, is_active: true } }),
      db.user.count({ where: { ...baseWhere, is_active: false } }),
      db.user.count({ where: baseWhere }),
    ]);

    return {
      active,
      inactive,
      all,
    };
  },

  async findStaffList(params: GetStaffParams = {}) {
    const page = params.page ?? 1;
    const limit = params.limit ?? params.pageSize ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildStaffWhere(params);

    const sortField = params.sortBy ?? "createdAt";
    const sortOrder = params.sortOrder ?? "desc";

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [data, total] = await Promise.all([
      db.user.findMany({
        where,
        include: staffInclude,
        orderBy,
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async createStaff(data: Prisma.UserUncheckedCreateInput) {
    return db.user.create({
      data,
      include: staffInclude,
    });
  },

  async updateStaffByUuid(
    uuid: string,
    data: Prisma.UserUncheckedUpdateInput
  ) {
    const existing = await this.findStaffByUuid(uuid);
    if (!existing) return null;

    return db.user.update({
      where: { id: existing.id },
      data,
      include: staffInclude,
    });
  },
};
