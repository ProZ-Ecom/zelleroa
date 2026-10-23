import { db } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma";
import type { GetAdminTagsParams } from "../types";

const liveProductMaps = {
  is_active: true,
  products: { isActive: true, deleted_at: null },
} satisfies Prisma.product_tag_mapsWhereInput;

const tagWithCount = {
  _count: { select: { product_tag_maps: { where: liveProductMaps } } },
  product_tag_maps: {
    where: liveProductMaps,
    select: {
      products: {
        select: {
          id: true,
          uuid: true,
          name: true,
        },
      },
    },
    orderBy: { products: { name: "asc" } },
  },
} satisfies Prisma.product_tagsInclude;

export const tagRepository = {
  async findAdminAll(params: GetAdminTagsParams = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const where: Prisma.product_tagsWhereInput = params.search
      ? { OR: [{ name: { contains: params.search } }, { slug: { contains: params.search } }] }
      : {};

    const [data, total] = await Promise.all([
      db.product_tags.findMany({
        where,
        include: tagWithCount,
        orderBy: [{ name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.product_tags.count({ where }),
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

  async findById(id: bigint) {
    return db.product_tags.findUnique({ where: { id }, include: tagWithCount });
  },

  async findBySlug(slug: string) {
    return db.product_tags.findUnique({ where: { slug } });
  },

  async create(data: Prisma.product_tagsUncheckedCreateInput) {
    return db.product_tags.create({ data, include: tagWithCount });
  },

  async update(id: bigint, data: Prisma.product_tagsUncheckedUpdateInput) {
    return db.product_tags.update({ where: { id }, data, include: tagWithCount });
  },

  async delete(id: bigint) {
    return db.product_tags.delete({ where: { id } });
  },

  async findProducts(tagId: bigint) {
    const maps = await db.product_tag_maps.findMany({
      where: { tag_id: tagId, products: { deleted_at: null } },
      select: { products: { select: { uuid: true, id: true, name: true } } },
      orderBy: { products: { name: "asc" } },
    });
    return maps.map((m) => m.products);
  },

  /** Resolves product public UUIDs to internal ids, ignoring deleted products. */
  async resolveProductIds(uuids: string[]) {
    if (uuids.length === 0) return [];
    const products = await db.product.findMany({
      where: { uuid: { in: uuids }, deleted_at: null },
      select: { id: true },
    });
    return products.map((p) => p.id);
  },

  async addProducts(tagId: bigint, productIds: bigint[], adminId: bigint | null) {
    if (productIds.length === 0) return;
    await db.product_tag_maps.createMany({
      data: productIds.map((product_id) => ({
        product_id,
        tag_id: tagId,
        created_by: adminId,
        updated_by: adminId,
      })),
      skipDuplicates: true,
    });
  },

  async removeProducts(tagId: bigint, productIds: bigint[]) {
    if (productIds.length === 0) return;
    await db.product_tag_maps.deleteMany({
      where: { tag_id: tagId, product_id: { in: productIds } },
    });
  },

  async setProducts(tagId: bigint, productIds: bigint[], adminId: bigint | null) {
    await db.$transaction([
      db.product_tag_maps.deleteMany({
        where: { tag_id: tagId, product_id: { notIn: productIds } },
      }),
      db.product_tag_maps.createMany({
        data: productIds.map((product_id) => ({
          product_id,
          tag_id: tagId,
          created_by: adminId,
          updated_by: adminId,
        })),
        skipDuplicates: true,
      }),
    ]);
  },
};
