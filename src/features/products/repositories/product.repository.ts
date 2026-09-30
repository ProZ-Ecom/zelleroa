import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { retireUniqueValue } from "@/lib/utils/retire-unique-value";
import type {
  GetAdminProductsParams,
  AdminProductListParams,
  AdminProductsCountResponse,
} from "../types";

const productAdminInclude = Prisma.validator<Prisma.ProductInclude>()({
  brand: {
    select: {
      id: true,
      uuid: true,
      name: true,
      slug: true,
      isActive: true,
    },
  },
  product_hsn_codes: {
    select: {
      id: true,
      uuid: true,
      code: true,
      description: true,
      is_active: true,
    },
  },
});

export const productRepository = {
  async findByUuid(uuid: string) {
    return db.product.findFirst({
      where: { uuid, isActive: true, deleted_at: null },
      include: productAdminInclude,
    });
  },

  async findById(id: number | bigint) {
    return db.product.findFirst({
      where: { id: BigInt(id), isActive: true, deleted_at: null },
      include: productAdminInclude,
    });
  },

  async findByName(name: string, excludeUuid?: string) {
    return db.product.findFirst({
      where: {
        name,
        isActive: true,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findBySlug(slug: string, excludeUuid?: string) {
    return db.product.findFirst({
      where: {
        slug,
        isActive: true,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findAdminAll(params: GetAdminProductsParams = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deleted_at: null,
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { slug: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.product.findMany({
        where,
        include: productAdminInclude,
        orderBy: [{ name: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.product.count({ where }),
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

  buildAdminProductWhere(
    params: AdminProductListParams,
    resolvedCategoryInternalId?: bigint,
    resolvedBrandInternalId?: bigint,
    resolvedHsnCodeInternalId?: bigint
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      deleted_at: null,
    };

    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (resolvedCategoryInternalId !== undefined) {
      where.categoryId = resolvedCategoryInternalId;
    }

    if (resolvedBrandInternalId !== undefined) {
      where.brandId = resolvedBrandInternalId;
    }

    if (resolvedHsnCodeInternalId !== undefined) {
      where.hsn_code_id = resolvedHsnCodeInternalId;
    }

    if (params.status !== undefined) {
      where.status = params.status;
    }

    if (params.search) {
      const search = params.search.trim();
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ];
    }

    return where;
  },

  buildAdminProductBaseWhere(
    params: AdminProductListParams,
    resolvedCategoryInternalId?: bigint,
    resolvedBrandInternalId?: bigint,
    resolvedHsnCodeInternalId?: bigint
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      deleted_at: null,
    };

    if (resolvedCategoryInternalId !== undefined) {
      where.categoryId = resolvedCategoryInternalId;
    }

    if (resolvedBrandInternalId !== undefined) {
      where.brandId = resolvedBrandInternalId;
    }

    if (resolvedHsnCodeInternalId !== undefined) {
      where.hsn_code_id = resolvedHsnCodeInternalId;
    }

    if (params.status !== undefined) {
      where.status = params.status;
    }

    if (params.search) {
      const search = params.search.trim();
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ];
    }

    return where;
  },

  async countAdminList(
    params: AdminProductListParams,
    resolvedCategoryInternalId?: bigint,
    resolvedBrandInternalId?: bigint,
    resolvedHsnCodeInternalId?: bigint
  ): Promise<AdminProductsCountResponse> {
    const baseWhere = this.buildAdminProductBaseWhere(
      params,
      resolvedCategoryInternalId,
      resolvedBrandInternalId,
      resolvedHsnCodeInternalId
    );

    const [active, inactive, all] = await Promise.all([
      db.product.count({ where: { ...baseWhere, isActive: true } }),
      db.product.count({ where: { ...baseWhere, isActive: false } }),
      db.product.count({ where: baseWhere }),
    ]);

    return {
      active,
      inactive,
      all,
    };
  },

  async findAdminList(
    params: AdminProductListParams,
    resolvedCategoryInternalId?: bigint,
    resolvedBrandInternalId?: bigint,
    resolvedHsnCodeInternalId?: bigint
  ) {
    const page = params.page ?? 1;
    const limit = params.limit ?? params.pageSize ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildAdminProductWhere(
      params,
      resolvedCategoryInternalId,
      resolvedBrandInternalId,
      resolvedHsnCodeInternalId
    );

    const sortField = params.sortBy ?? "createdAt";
    const sortOrder = params.sortOrder ?? "desc";

    const orderBy: Prisma.ProductOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [data, total] = await Promise.all([
      db.product.findMany({
        where,
        include: productAdminInclude,
        orderBy,
        skip,
        take: limit,
      }),
      db.product.count({ where }),
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


  async create(data: Prisma.ProductUncheckedCreateInput) {
    return db.product.create({
      data,
      include: productAdminInclude,
    });
  },

  async updateByUuid(
    uuid: string,
    data: Prisma.ProductUncheckedUpdateInput
  ) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.product.update({
      where: { id: existing.id },
      data,
      include: productAdminInclude,
    });
  },

  async softDeleteByUuid(uuid: string, adminId?: bigint | null) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    // Carts must not keep lines for a product that can no longer be bought,
    // otherwise checkout fails with "no longer available".
    await db.cartItem.deleteMany({ where: { productId: existing.id } });

    return db.product.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        deleted_at: new Date(),
        // Free the unique slug so a new product can reuse it; the archived row
        // keeps a namespaced slug instead of blocking the insert.
        slug: retireUniqueValue(existing.slug, existing.id, 220),
        ...(adminId ? { updated_by: adminId } : {}),
      },
    });
  },
};
