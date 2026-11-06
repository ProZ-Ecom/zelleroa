import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { retireUniqueValue } from "@/lib/utils/retire-unique-value";
import type { GetBrandsParams, GetAdminBrandsParams } from "../types";

const brandListInclude = Prisma.validator<Prisma.ProductBrandInclude>()({
  _count: { select: { products: true } },
});

const brandDetailInclude = Prisma.validator<Prisma.ProductBrandInclude>()({
  products: {
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
    },
  },
  _count: { select: { products: true } },
});

async function buildBrandWhere(params: GetBrandsParams): Promise<Prisma.ProductBrandWhereInput> {
  const where: Prisma.ProductBrandWhereInput = { isActive: true, deleted_at: null };

  if (params.search) {
    where.OR = [
      { name: { contains: params.search } },
      { description: { contains: params.search } },
    ];
  }

  if (params.categorySlug) {
    const root = await db.productCategory.findFirst({
      where: { slug: params.categorySlug, deleted_at: null },
      select: { id: true },
    });
    if (root) {
      const all: bigint[] = [root.id];
      let frontier: bigint[] = [root.id];
      while (frontier.length > 0) {
        const children = await db.productCategory.findMany({
          where: { parentId: { in: frontier }, deleted_at: null },
          select: { id: true },
        });
        frontier = children.map((c) => c.id);
        all.push(...frontier);
      }
      where.products = {
        some: {
          categoryId: { in: all },
          deleted_at: null,
        },
      };
    } else {
      where.id = { in: [] };
    }
  }

  return where;
}

export const brandRepository = {
  async findAll(params: GetBrandsParams = {}) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const where = await buildBrandWhere(params);

    const [data, total] = await Promise.all([
      db.productBrand.findMany({
        where,
        include: brandListInclude,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.productBrand.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findBySlugOrId(slugOrId: string) {
    const numericId = parseInt(slugOrId);
    return db.productBrand.findFirst({
      where: {
        isActive: true,
        deleted_at: null,
        OR: [
          { slug: slugOrId },
          { uuid: slugOrId },
          ...(numericId ? [{ id: numericId }] : []),
        ],
      },
      include: brandDetailInclude,
    });
  },

  async findById(id: number | bigint) {
    return db.productBrand.findFirst({
      where: { id: BigInt(id), isActive: true, deleted_at: null },
      include: brandDetailInclude,
    });
  },

  async findByUuid(uuid: string) {
    return db.productBrand.findFirst({
      where: { uuid, isActive: true, deleted_at: null },
    });
  },

  async findBySlug(slug: string, excludeUuid?: string) {
    return db.productBrand.findFirst({
      where: {
        slug,
        isActive: true,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findByName(name: string, excludeUuid?: string) {
    return db.productBrand.findFirst({
      where: {
        name,
        isActive: true,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findAdminAll(params: GetAdminBrandsParams = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;

    const where: Prisma.ProductBrandWhereInput = {
      isActive: true,
      deleted_at: null,
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { description: { contains: params.search } },
        { slug: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.productBrand.findMany({
        where,
        orderBy: [{ name: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.productBrand.count({ where }),
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

  async create(data: Prisma.ProductBrandUncheckedCreateInput) {
    return db.productBrand.create({
      data,
    });
  },

  async updateByUuid(uuid: string, data: Prisma.ProductBrandUncheckedUpdateInput) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.productBrand.update({
      where: { id: existing.id },
      data,
    });
  },

  async softDeleteByUuid(uuid: string, adminId?: bigint | null) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.productBrand.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        deleted_at: new Date(),
        // Free the unique slug so a new brand can reuse it; the archived row
        // keeps a namespaced slug instead of blocking the insert.
        slug: retireUniqueValue(existing.slug, existing.id, 170),
        ...(adminId ? { updated_by: adminId } : {}),
      },
    });
  },

  async update(id: number | bigint, data: Prisma.ProductBrandUncheckedUpdateInput) {
    return db.productBrand.update({
      where: { id: BigInt(id) },
      data,
      include: brandDetailInclude,
    });
  },

  async delete(id: number | bigint) {
    return db.productBrand.delete({ where: { id: BigInt(id) } });
  },

  async count(where?: Prisma.ProductBrandWhereInput) {
    return db.productBrand.count({ where });
  },
};
