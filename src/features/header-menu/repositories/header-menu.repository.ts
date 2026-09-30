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

  async create(data: Prisma.HeaderMenuItemUncheckedCreateInput, categoryIds: bigint[]) {
    return db.headerMenuItem.create({
      data: {
        ...data,
        categories: {
          create: categoryIds.map((categoryId, index) => ({ categoryId, sortOrder: index })),
        },
      },
      include: headerMenuCategoriesInclude,
    });
  },

  /** `categoryIds` omitted leaves the existing category set untouched; pass `[]` to clear it. */
  async updateByUuid(
    uuid: string,
    data: Prisma.HeaderMenuItemUncheckedUpdateInput,
    categoryIds?: bigint[]
  ) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    if (categoryIds !== undefined) {
      await db.$transaction([
        db.headerMenuItemCategory.deleteMany({ where: { headerMenuItemId: existing.id } }),
        db.headerMenuItemCategory.createMany({
          data: categoryIds.map((categoryId, index) => ({
            headerMenuItemId: existing.id,
            categoryId,
            sortOrder: index,
          })),
        }),
        db.headerMenuItem.update({ where: { id: existing.id }, data }),
      ]);
    } else {
      await db.headerMenuItem.update({ where: { id: existing.id }, data });
    }

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
