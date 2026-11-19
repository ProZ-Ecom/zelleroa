import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import type { GetAdminHeaderMenuParams } from "../types";

const headerMenuCategoriesInclude = Prisma.validator<Prisma.HeaderMenuItemInclude>()({
  categories: {
    orderBy: { sortOrder: "asc" },
    include: {
      category: { select: { id: true, uuid: true, slug: true, name: true, icon: true } },
    },
  },
  tags: {
    orderBy: { sortOrder: "asc" },
    include: { tag: { select: { id: true, slug: true, name: true, is_active: true } } },
  },
});

function buildAdminHeaderMenuWhere(
  params: GetAdminHeaderMenuParams = {}
): Prisma.HeaderMenuItemWhereInput {
  const where: Prisma.HeaderMenuItemWhereInput = { deleted_at: null };

  if (params.search) {
    where.OR = [
      { label: { contains: params.search } },
      { link: { contains: params.search } },
    ];
  }

  return where;
}

export const headerMenuRepository = {
  /** Active items with their categories (for the live nav), sorted for display. */
  async findActiveOrdered() {
    return db.headerMenuItem.findMany({
      where: { isActive: true, deleted_at: null },
      include: headerMenuCategoriesInclude,
      orderBy: { sortOrder: "asc" },
    });
  },

  async findAdminAll(params: GetAdminHeaderMenuParams = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const where = buildAdminHeaderMenuWhere(params);

    const [data, total] = await Promise.all([
      db.headerMenuItem.findMany({
        where,
        include: headerMenuCategoriesInclude,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.headerMenuItem.count({ where }),
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

  async findByUuid(uuid: string) {
    return db.headerMenuItem.findFirst({
      where: { uuid, deleted_at: null },
      include: headerMenuCategoriesInclude,
    });
  },

  async countNonDeleted() {
    return db.headerMenuItem.count({
      where: { deleted_at: null },
    });
  },

  async create(
    data: Prisma.HeaderMenuItemUncheckedCreateInput,
    categoryIds: bigint[],
    tagIds: bigint[] = []
  ) {
    const currentCount = await this.countNonDeleted();
    if (currentCount >= 10) {
      throw new Error("A maximum of 10 header menu items can exist. Cannot add more.");
    }

    return db.headerMenuItem.create({
      data: {
        ...data,
        categories: {
          create: categoryIds.map((categoryId, index) => ({ categoryId, sortOrder: index })),
        },
        tags: {
          create: tagIds.map((tagId, index) => ({ tagId, sortOrder: index })),
        },
      },
      include: headerMenuCategoriesInclude,
    });
  },

  /** `categoryIds` / `tagIds` omitted leave the existing set untouched; pass `[]` to clear it. */
  async updateByUuid(
    uuid: string,
    data: Prisma.HeaderMenuItemUncheckedUpdateInput,
    categoryIds?: bigint[],
    tagIds?: bigint[]
  ) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    await db.$transaction([
      ...(categoryIds !== undefined
        ? [
            db.headerMenuItemCategory.deleteMany({ where: { headerMenuItemId: existing.id } }),
            db.headerMenuItemCategory.createMany({
              data: categoryIds.map((categoryId, index) => ({
                headerMenuItemId: existing.id,
                categoryId,
                sortOrder: index,
              })),
            }),
          ]
        : []),
      ...(tagIds !== undefined
        ? [
            db.headerMenuItemTag.deleteMany({ where: { headerMenuItemId: existing.id } }),
            db.headerMenuItemTag.createMany({
              data: tagIds.map((tagId, index) => ({
                headerMenuItemId: existing.id,
                tagId,
                sortOrder: index,
              })),
            }),
          ]
        : []),
      db.headerMenuItem.update({ where: { id: existing.id }, data }),
    ]);

    return this.findByUuid(uuid);
  },

  async softDeleteByUuid(uuid: string, adminId?: bigint | null) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.headerMenuItem.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        deleted_at: new Date(),
        ...(adminId ? { updated_by: adminId } : {}),
      },
    });
  },
};
