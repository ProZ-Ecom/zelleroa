import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { retireUniqueValue } from "@/lib/utils/retire-unique-value";
import type {
  GetCategoriesParams,
  GetAdminCategoriesParams,
  AdminCategoriesCountResponse,
} from "../types";

const categoryListInclude = Prisma.validator<Prisma.ProductCategoryInclude>()({
  _count: { select: { children: true } },
});

const categoryDetailInclude = Prisma.validator<Prisma.ProductCategoryInclude>()({
  parent: { select: { id: true, name: true, slug: true } },
  children: {
    where: { isActive: true, deleted_at: null },
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      _count: { select: { children: true } },
    },
  },
  _count: { select: { children: true } },
});

function buildCategoryWhere(params: GetCategoriesParams): Prisma.ProductCategoryWhereInput {
  const where: Prisma.ProductCategoryWhereInput = { isActive: true, deleted_at: null };

  if (params.search) {
    where.OR = [
      { name: { contains: params.search } },
      { description: { contains: params.search } },
    ];
  }

  if (params.parentId !== undefined) {
    where.parentId = params.parentId;
  }

  return where;
}

function buildAdminCategoryWhere(params: GetAdminCategoriesParams = {}): Prisma.ProductCategoryWhereInput {
  const where: Prisma.ProductCategoryWhereInput = {
    deleted_at: null,
  };

  if (typeof params.isActive === "boolean") {
    where.isActive = params.isActive;
  }

  if (params.search) {
    where.OR = [
      { name: { contains: params.search } },
      { description: { contains: params.search } },
      { slug: { contains: params.search } },
    ];
  }

  return where;
}

export const categoryRepository = {
  buildAdminCategoryWhere,

  /** All active categories, minimal fields — used to build the in-memory category tree for nav/routing. */
  async findAllActiveFlat() {
    return db.productCategory.findMany({
      where: { isActive: true, deleted_at: null },
      select: {
        id: true,
        uuid: true,
        slug: true,
        name: true,
        icon: true,
        parentId: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    });
  },

  async findAll(params: GetCategoriesParams = {}) {
    const where = buildCategoryWhere(params);
    return db.productCategory.findMany({
      where,
      include: categoryListInclude,
      orderBy: { sortOrder: "asc" },
    });
  },

  async findBySlugOrId(slugOrId: string) {
    const numericId = parseInt(slugOrId);
    return db.productCategory.findFirst({
      where: {
        isActive: true,
        deleted_at: null,
        OR: [
          { slug: slugOrId },
          { uuid: slugOrId },
          ...(numericId ? [{ id: numericId }] : []),
        ],
      },
      include: categoryDetailInclude,
    });
  },

  async findById(id: number | bigint) {
    return db.productCategory.findFirst({
      where: { id: BigInt(id), isActive: true, deleted_at: null },
      include: categoryDetailInclude,
    });
  },

  async findByUuid(uuid: string) {
    return db.productCategory.findFirst({
      where: { uuid, isActive: true, deleted_at: null },
    });
  },

  async findBySlug(slug: string, excludeUuid?: string) {
    return db.productCategory.findFirst({
      where: {
        slug,
        isActive: true,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findByName(name: string, excludeUuid?: string) {
    return db.productCategory.findFirst({
      where: {
        name,
        isActive: true,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async countAdminCategories(
    params: GetAdminCategoriesParams = {}
  ): Promise<AdminCategoriesCountResponse> {
    const baseWhere: Prisma.ProductCategoryWhereInput = {
      deleted_at: null,
    };

    if (params.search) {
      baseWhere.OR = [
        { name: { contains: params.search } },
        { description: { contains: params.search } },
        { slug: { contains: params.search } },
      ];
    }

    const [active, inactive, all] = await Promise.all([
      db.productCategory.count({ where: { ...baseWhere, isActive: true } }),
      db.productCategory.count({ where: { ...baseWhere, isActive: false } }),
      db.productCategory.count({ where: baseWhere }),
    ]);

    return {
      active,
      inactive,
      all,
    };
  },

  async findAdminAll(params: GetAdminCategoriesParams = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? params.limit ?? 10;

    const where = buildAdminCategoryWhere(params);

    const [data, total] = await Promise.all([
      db.productCategory.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.productCategory.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  },

  async create(data: Prisma.ProductCategoryUncheckedCreateInput) {
    return db.productCategory.create({
      data,
    });
  },

  async updateByUuid(uuid: string, data: Prisma.ProductCategoryUncheckedUpdateInput) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.productCategory.update({
      where: { id: existing.id },
      data,
    });
  },

  async softDeleteByUuid(uuid: string, adminId?: bigint | null) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.$transaction(async (tx) => {
      const category = await tx.productCategory.update({
        where: { id: existing.id },
        data: {
          isActive: false,
          deleted_at: new Date(),
          // Free the unique slug so a new category can reuse it; the archived row
          // keeps a namespaced slug instead of blocking the insert.
          slug: retireUniqueValue(existing.slug, existing.id, 170),
          ...(adminId ? { updated_by: adminId } : {}),
        },
      });

      // Cascade the soft delete to every product under this category, and
      // from there to their styles ("items" in the storefront) and item
      // sub-variants, so nothing orphaned stays visible after the category
      // disappears.
      const now = new Date();

      const products = await tx.product.findMany({
        where: { categoryId: existing.id, deleted_at: null },
        select: { id: true, slug: true },
      });
      await Promise.all(
        products.map((product) =>
          tx.product.update({
            where: { id: product.id },
            data: {
              isActive: false,
              deleted_at: now,
              slug: retireUniqueValue(product.slug, product.id, 220),
              ...(adminId ? { updated_by: adminId } : {}),
            },
          })
        )
      );

      if (products.length > 0) {
        const styles = await tx.style.findMany({
          where: { productId: { in: products.map((p) => p.id) }, deleted_at: null },
          select: { id: true, slug: true, sku: true },
        });
        await Promise.all(
          styles.map((style) =>
            tx.style.update({
              where: { id: style.id },
              data: {
                isActive: false,
                deleted_at: now,
                slug: retireUniqueValue(style.slug, style.id, 220),
                ...(style.sku ? { sku: retireUniqueValue(style.sku, style.id, 100) } : {}),
                ...(adminId ? { updated_by: adminId } : {}),
              },
            })
          )
        );

        if (styles.length > 0) {
          const items = await tx.item.findMany({
            where: { styleId: { in: styles.map((s) => s.id) }, deleted_at: null },
            select: { id: true, slug: true, sku: true },
          });
          await Promise.all(
            items.map((item) =>
              tx.item.update({
                where: { id: item.id },
                data: {
                  isActive: false,
                  deleted_at: now,
                  slug: retireUniqueValue(item.slug, item.id, 220),
                  ...(item.sku ? { sku: retireUniqueValue(item.sku, item.id, 100) } : {}),
                  ...(adminId ? { updated_by: adminId } : {}),
                },
              })
            )
          );
        }
      }

      return category;
    });
  },

  async update(id: number | bigint, data: Prisma.ProductCategoryUncheckedUpdateInput) {
    return db.productCategory.update({
      where: { id: BigInt(id) },
      data,
      include: categoryDetailInclude,
    });
  },

  async delete(id: number | bigint) {
    return db.productCategory.delete({ where: { id: BigInt(id) } });
  },

  async count(where?: Prisma.ProductCategoryWhereInput) {
    return db.productCategory.count({ where });
  },
};
