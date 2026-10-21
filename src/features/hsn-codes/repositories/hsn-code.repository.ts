import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { retireUniqueValue } from "@/lib/utils/retire-unique-value";
import type { GetAdminHsnCodesParams } from "../types";

const hsnInclude = Prisma.validator<Prisma.product_hsn_codesInclude>()({
  product_gst_rates: {
    select: {
      id: true,
      uuid: true,
      name: true,
      is_active: true,
    },
  },
});

export const hsnCodeRepository = {
  async findByUuid(uuid: string) {
    return db.product_hsn_codes.findFirst({
      where: { uuid, is_active: true },
      include: hsnInclude,
    });
  },

  async findById(id: number | bigint) {
    return db.product_hsn_codes.findFirst({
      where: { id: BigInt(id), is_active: true },
      include: hsnInclude,
    });
  },

  async findByCode(code: string, excludeUuid?: string) {
    return db.product_hsn_codes.findFirst({
      where: {
        code,
        is_active: true,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findAdminAll(params: GetAdminHsnCodesParams = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;

    const where: Prisma.product_hsn_codesWhereInput = {
      is_active: true,
    };

    if (params.search) {
      where.OR = [
        { code: { contains: params.search } },
        { description: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.product_hsn_codes.findMany({
        where,
        include: hsnInclude,
        orderBy: [{ code: "asc" }, { created_at: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.product_hsn_codes.count({ where }),
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

  async create(data: Prisma.product_hsn_codesUncheckedCreateInput) {
    return db.product_hsn_codes.create({
      data,
      include: hsnInclude,
    });
  },

  async updateByUuid(
    uuid: string,
    data: Prisma.product_hsn_codesUncheckedUpdateInput
  ) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.product_hsn_codes.update({
      where: { id: existing.id },
      data,
      include: hsnInclude,
    });
  },

  async softDeleteByUuid(uuid: string, adminId?: bigint | null) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.product_hsn_codes.update({
      where: { id: existing.id },
      data: {
        is_active: false,
        // Free the unique code so the same HSN code can be added again.
        code: retireUniqueValue(existing.code, existing.id, 20),
        ...(adminId ? { updated_by: adminId } : {}),
      },
    });
  },
};
