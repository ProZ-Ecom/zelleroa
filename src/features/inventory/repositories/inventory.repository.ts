import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import type { inventory_transactions_type } from "@/generated/prisma";

interface FindAllParams {
  page?: number;
  limit?: number;
  search?: string;
  productUuid?: string;
  color?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
}

const inventoryVariantSelect = {
  id: true,
  variant_name: true,
  color_name: true,
  style: { select: { id: true, uuid: true, name: true, slug: true, product: { select: { id: true, uuid: true, name: true, slug: true } } } },
} as const;

interface FindTransactionsParams {
  page?: number;
  limit?: number;
  type?: inventory_transactions_type;
}

export const inventoryRepository = {
  async findAll(params: FindAllParams) {
    const { page = 1, limit = 10, search, productUuid, color, lowStock, outOfStock } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryWhereInput = { is_active: true };

    const variantUnitPriceWhere: Prisma.VariantUnitPriceWhereInput = {};
    const variantWhere: Prisma.ProductVariantWhereInput = {};
    const productWhere: Prisma.ProductWhereInput = {};

    if (search) {
      productWhere.name = { contains: search };
    }
    if (productUuid) {
      productWhere.uuid = productUuid;
    }
    if (Object.keys(productWhere).length > 0) {
      variantWhere.style = { product: productWhere };
    }
    if (color) {
      variantWhere.color_name = { contains: color };
    }
    if (Object.keys(variantWhere).length > 0) {
      variantUnitPriceWhere.variant = variantWhere;
    }
    if (Object.keys(variantUnitPriceWhere).length > 0) {
      where.variant_unit_price = variantUnitPriceWhere;
    }

    const include = {
      variant_unit_price: {
        include: {
          variant: { select: inventoryVariantSelect },
          product_units: { select: { name: true, code: true } },
        },
      },
    } satisfies Prisma.InventoryInclude;

    // Prisma can't compare quantity_available to reorderLevel (two columns on
    // the same row) in a `where`, so low-stock/out-of-stock filtering is done
    // in-memory here, matching the pattern already used by getLowStock/getOutOfStock.
    if (lowStock || outOfStock) {
      const all = await db.inventory.findMany({
        where,
        include,
        orderBy: { updatedAt: "desc" },
      });

      const filtered = all.filter((item) =>
        outOfStock
          ? item.quantity_available === 0
          : item.quantity_available > 0 && item.quantity_available <= item.reorderLevel
      );

      return { data: filtered.slice(skip, skip + limit), total: filtered.length };
    }

    const [data, total] = await Promise.all([
      db.inventory.findMany({
        where,
        include,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
      db.inventory.count({ where }),
    ]);

    return { data, total };
  },

  async findById(id: number | bigint) {
    return db.inventory.findUnique({
      where: { id: BigInt(id) },
      include: {
        variant_unit_price: {
          include: {
            variant: {
              select: {
                id: true,
                variant_name: true,
                style: { select: { id: true, name: true, slug: true, product: { select: { id: true, name: true, slug: true } } } },
              },
            },
          },
        },
      },
    });
  },

  async findByVariantUnitPriceId(variantUnitPriceId: number | bigint) {
    return db.inventory.findFirst({
      where: {
        variantUnitPriceId: BigInt(variantUnitPriceId),
        is_active: true,
      },
    });
  },

  async create(data: Prisma.InventoryCreateInput) {
    return db.inventory.create({ data });
  },

  async update(id: number | bigint, data: Prisma.InventoryUpdateInput) {
    return db.inventory.update({ where: { id: BigInt(id) }, data });
  },

  async findTransactionsByVariantUnitPriceId(
    variantUnitPriceId: number | bigint,
    params: FindTransactionsParams
  ) {
    const { page = 1, limit = 20, type } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryTransactionWhereInput = {
      variant_unit_price_id: BigInt(variantUnitPriceId),
      is_active: true,
    };

    if (type) {
      where.type = type;
    }

    const [data, total] = await Promise.all([
      db.inventoryTransaction.findMany({
        where,
        include: {
          variant_unit_price: {
            include: {
              variant: {
                select: {
                  style: { select: { product: { select: { name: true } } } },
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.inventoryTransaction.count({ where }),
    ]);

    return { data, total };
  },

  async createTransaction(
    data: Prisma.InventoryTransactionCreateInput
  ) {
    return db.inventoryTransaction.create({ data });
  },

  async sumTransactionsByType(variantUnitPriceIds: bigint[]) {
    if (variantUnitPriceIds.length === 0) return [];
    return db.inventoryTransaction.groupBy({
      by: ["variant_unit_price_id", "type"],
      where: {
        is_active: true,
        variant_unit_price_id: { in: variantUnitPriceIds },
      },
      _sum: { quantity: true },
    });
  },
};
