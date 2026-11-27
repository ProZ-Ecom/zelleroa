import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { retireUniqueValue } from "@/lib/utils/retire-unique-value";
import type { GetAdminUnitsParams } from "../types";

const unitInclude = Prisma.validator<Prisma.product_unitsInclude>()({
  product_units: {
    select: {
      id: true,
      uuid: true,
      name: true,
      code: true,
      type: true,
      is_active: true,
    },
  },
});

export const unitRepository = {
  async findByUuid(uuid: string) {
    return db.product_units.findFirst({
      where: { uuid, is_active: true },
      include: unitInclude,
    });
  },

  async findById(id: number | bigint) {
    return db.product_units.findFirst({
      where: { id: BigInt(id), is_active: true },
      include: unitInclude,
    });
  },

  async findByName(name: string, excludeUuid?: string) {
    return db.product_units.findFirst({
      where: {
        name,
        is_active: true,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findByCode(code: string, excludeUuid?: string) {
    return db.product_units.findFirst({
      where: {
        code,
        is_active: true,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findAdminAll(params: GetAdminUnitsParams = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;

    const where: Prisma.product_unitsWhereInput = {
      is_active: true,
    };

    if (params.type) {
      where.type = params.type;
    }

    if (params.hierarchy === "base") {
      where.base_unit_id = null;
    } else if (params.hierarchy === "derived") {
      where.base_unit_id = { not: null };
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { code: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.product_units.findMany({
        where,
        include: unitInclude,
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.product_units.count({ where }),
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

  async create(data: Prisma.product_unitsUncheckedCreateInput) {
    return db.product_units.create({
      data: {
        ...data,
        uuid: data.uuid || crypto.randomUUID(),
      },
      include: unitInclude,
    });
  },

  async updateByUuid(
    uuid: string,
    data: Prisma.product_unitsUncheckedUpdateInput
  ) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.product_units.update({
      where: { id: existing.id },
      data,
      include: unitInclude,
    });
  },

  async softDeleteByUuid(uuid: string, adminId?: bigint | null) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.product_units.update({
      where: { id: existing.id },
      data: {
        is_active: false,
        // Free the unique code so a new unit can reuse it. VarChar(10) has no
        // room for a readable suffix, so the archived row keeps a bare marker.
        code: retireUniqueValue(existing.code, existing.id, 10),
        ...(adminId ? { updated_by: adminId } : {}),
      },
    });
  },
};
