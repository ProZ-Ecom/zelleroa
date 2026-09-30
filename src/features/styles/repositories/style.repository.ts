import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { retireUniqueValue } from "@/lib/utils/retire-unique-value";
import type { GetAdminStylesParams } from "../types";

export const styleInclude = Prisma.validator<Prisma.StyleInclude>()({
  product: {
    select: {
      id: true,
      uuid: true,
      name: true,
      slug: true,
      isActive: true,
      deleted_at: true,
      categoryId: true,
      brand: { select: { uuid: true, name: true } },
    },
  },
  brand: {
    select: { uuid: true, name: true },
  },
  images: {
    where: { is_active: true },
    select: {
      uuid: true,
      image_url: true,
      is_primary: true,
      sort_order: true,
    },
    orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
  },
  _count: {
    select: { items: { where: { deleted_at: null } } },
  },
});

export const styleRepository = {
  async findByUuid(uuid: string) {
    return db.style.findFirst({
      where: { uuid, deleted_at: null },
      include: styleInclude,
    });
  },

  async findById(id: number | bigint) {
    return db.style.findFirst({
      where: { id: BigInt(id), deleted_at: null },
      include: styleInclude,
    });
  },

  async findBySlug(slug: string, excludeUuid?: string) {
    return db.style.findFirst({
      where: {
        slug,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findAllByProductId(productId: bigint, params: GetAdminStylesParams = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where: Prisma.StyleWhereInput = {
      productId,
      deleted_at: null,
    };

    if (typeof params.isActive === "boolean") {
      where.isActive = params.isActive;
    }

    if (params.search) {
      where.name = { contains: params.search };
    }

    const [data, total] = await Promise.all([
      db.style.findMany({
        where,
        include: styleInclude,
        orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.style.count({ where }),
    ]);

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

  async findAdminList(params: GetAdminStylesParams = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where: Prisma.StyleWhereInput = {
      deleted_at: null,
    };

    if (typeof params.isActive === "boolean") {
      where.isActive = params.isActive;
    }

    if (params.search) {
      where.name = { contains: params.search };
    }

    if (params.productId) {
      where.product = { uuid: params.productId };
    }

    if (params.categoryId) {
      where.product = { ...(where.product as object), categoryId: BigInt(params.categoryId) };
    }

    const [data, total] = await Promise.all([
      db.style.findMany({
        where,
        include: styleInclude,
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.style.count({ where }),
    ]);

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

  async create(data: Prisma.StyleUncheckedCreateInput) {
    return db.style.create({
      data,
      include: styleInclude,
    });
  },

  async updateByUuid(uuid: string, data: Prisma.StyleUncheckedUpdateInput) {
    const existing = await db.style.findFirst({ where: { uuid, deleted_at: null } });
    if (!existing) return null;

    return db.style.update({
      where: { id: existing.id },
      data,
      include: styleInclude,
    });
  },

  async softDeleteByUuid(uuid: string, adminId?: bigint | null) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.style.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        deleted_at: new Date(),
        // Free the unique slug/sku so a new style can reuse them; the archived
        // row keeps namespaced values instead of blocking the insert.
        slug: retireUniqueValue(existing.slug, existing.id, 220),
        ...(existing.sku
          ? { sku: retireUniqueValue(existing.sku, existing.id, 100) }
          : {}),
        ...(adminId ? { updated_by: adminId } : {}),
      },
    });
  },

  async countActiveByProductId(productId: bigint): Promise<number> {
    return db.style.count({ where: { productId, deleted_at: null } });
  },
};
