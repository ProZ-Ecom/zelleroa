import crypto from "crypto";
import { setStockLevel } from "@/features/inventory/services/stock-ledger.service";
import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import { retireUniqueValue } from "@/lib/utils/retire-unique-value";
import type { GetVariantPriceHistoryParams } from "../types";

export const variantUnitPriceInclude = Prisma.validator<Prisma.VariantUnitPriceInclude>()({
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
  inventories: {
    select: {
      id: true,
      quantity_available: true,
      quantity_reserved: true,
    },
  },
  attribute_value: {
    select: { uuid: true, value: true },
  },
  variant: {
    select: {
      id: true,
      uuid: true,
      variant_name: true,
      itemId: true,
    },
  },
});

export const variantUnitPriceRepository = {
  async findByUuid(uuid: string) {
    return db.variantUnitPrice.findFirst({
      where: { uuid, deleted_at: null },
      include: variantUnitPriceInclude,
    });
  },

  async findById(id: number | bigint) {
    return db.variantUnitPrice.findFirst({
      where: { id: BigInt(id), deleted_at: null },
      include: variantUnitPriceInclude,
    });
  },

  async findBySku(sku: string, excludeUuid?: string) {
    return db.variantUnitPrice.findFirst({
      where: {
        sku,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findAllByVariantId(variantId: bigint) {
    return db.variantUnitPrice.findMany({
      where: { variant_id: variantId, deleted_at: null },
      include: variantUnitPriceInclude,
      orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
    });
  },

  async findByVariantAndUnit(
    variantId: bigint,
    unitId: bigint,
    unitValue: number | Prisma.Decimal,
    excludeUuid?: string
  ) {
    return db.variantUnitPrice.findFirst({
      where: {
        variant_id: variantId,
        unit_id: unitId,
        unit_value: unitValue,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findByVariantAndSize(
    variantId: bigint,
    attributeValueId: bigint | null,
    excludeUuid?: string
  ) {
    return db.variantUnitPrice.findFirst({
      where: {
        variant_id: variantId,
        attribute_value_id: attributeValueId,
        deleted_at: null,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async create(data: Prisma.VariantUnitPriceUncheckedCreateInput) {
    return db.variantUnitPrice.create({
      data,
      include: variantUnitPriceInclude,
    });
  },

  async unsetDefaultForVariant(variantId: bigint, excludeId?: bigint) {
    return db.variantUnitPrice.updateMany({
      where: {
        variant_id: variantId,
        deleted_at: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { is_default: false },
    });
  },

  async updateByUuid(
    uuid: string,
    data: Prisma.VariantUnitPriceUncheckedUpdateInput & { stock?: number },
    adminId?: bigint | null
  ) {
    return db.$transaction(async (tx) => {
      const existing = await tx.variantUnitPrice.findFirst({
        where: { uuid, deleted_at: null },
      });
      if (!existing) return null;

      const oldBasePrice = Number(existing.base_price);
      const newBasePrice =
        data.base_price !== undefined ? Number(data.base_price) : oldBasePrice;

      const isBasePriceChanged =
        data.base_price !== undefined && oldBasePrice !== newBasePrice;

      if (isBasePriceChanged) {
        await tx.variant_price_history.create({
          data: {
            uuid: crypto.randomUUID(),
            variant_unit_price_id: existing.id,
            old_base_price: oldBasePrice,
            new_base_price: newBasePrice,
            changed_at: new Date(),
            is_active: true,
            created_by: adminId ?? null,
            updated_by: adminId ?? null,
          },
        });
      }

      const { stock, ...updateData } = data;

      if (data.is_default === true) {
        await tx.variantUnitPrice.updateMany({
          where: { variant_id: existing.variant_id, id: { not: existing.id } },
          data: { is_default: false },
        });
      }

      if (stock !== undefined) {
        await setStockLevel(tx, {
          variantUnitPriceId: existing.id,
          target: stock,
          reason: "Set via product/variant form",
          actorId: adminId ?? null,
        });
      }

      return tx.variantUnitPrice.update({
        where: { id: existing.id },
        data: updateData,
        include: variantUnitPriceInclude,
      });
    });
  },

  async bulkUpdateUnitPrices(
    items: Array<{
      id: string; // variant-unit-price UUID
      price?: number;
      basePrice?: number;
      stock?: number;
      isActive?: boolean;
    }>,
    adminId?: bigint | null
  ) {
    return db.$transaction(async (tx) => {
      const updated = [];

      for (const item of items) {
        const existing = await tx.variantUnitPrice.findFirst({
          where: { uuid: item.id, deleted_at: null },
        });

        if (!existing) {
          throw new Error(`Variant unit price with ID '${item.id}' not found`);
        }

        const effectiveBasePrice =
          item.price !== undefined ? item.price : item.basePrice;

        const oldBasePrice = Number(existing.base_price);
        const newBasePrice =
          effectiveBasePrice !== undefined ? Number(effectiveBasePrice) : oldBasePrice;

        const isBasePriceChanged =
          effectiveBasePrice !== undefined && oldBasePrice !== newBasePrice;

        if (isBasePriceChanged) {
          await tx.variant_price_history.create({
            data: {
              uuid: crypto.randomUUID(),
              variant_unit_price_id: existing.id,
              old_base_price: oldBasePrice,
              new_base_price: newBasePrice,
              changed_at: new Date(),
              is_active: true,
              created_by: adminId ?? null,
              updated_by: adminId ?? null,
            },
          });
        }

        const updateData: Prisma.VariantUnitPriceUncheckedUpdateInput = {};
        if (effectiveBasePrice !== undefined) {
          updateData.base_price = effectiveBasePrice;
        }
        if (typeof item.isActive === "boolean") {
          updateData.isActive = item.isActive;
        }
        if (adminId) {
          updateData.updated_by = adminId;
        }

        if (item.stock !== undefined) {
          await setStockLevel(tx, {
            variantUnitPriceId: existing.id,
            target: item.stock,
            reason: "Set via bulk edit",
            actorId: adminId ?? null,
          });
        }

        const result = await tx.variantUnitPrice.update({
          where: { id: existing.id },
          data: updateData,
          include: variantUnitPriceInclude,
        });

        updated.push(result);
      }

      return updated;
    });
  },

  /**
   * "Same price for all sizes" - sets base_price uniformly across every unit
   * price row under one variant, then applies any per-row overrides on top in
   * the same transaction, tracking price history for every row that actually
   * changed.
   */
  async bulkSetSamePrice(
    variantId: bigint,
    basePrice: number,
    perSizeOverrides: Array<{ id: string; basePrice?: number; sku?: string }>,
    adminId?: bigint | null
  ) {
    return db.$transaction(async (tx) => {
      const rows = await tx.variantUnitPrice.findMany({
        where: { variant_id: variantId, deleted_at: null },
      });

      const overrideByUuid = new Map(perSizeOverrides.map((o) => [o.id, o]));

      for (const row of rows) {
        const override = overrideByUuid.get(row.uuid);
        const effectiveBasePrice = override?.basePrice ?? basePrice;
        const oldBasePrice = Number(row.base_price);

        if (effectiveBasePrice !== oldBasePrice) {
          await tx.variant_price_history.create({
            data: {
              uuid: crypto.randomUUID(),
              variant_unit_price_id: row.id,
              old_base_price: oldBasePrice,
              new_base_price: effectiveBasePrice,
              changed_at: new Date(),
              is_active: true,
              created_by: adminId ?? null,
              updated_by: adminId ?? null,
            },
          });
        }

        await tx.variantUnitPrice.update({
          where: { id: row.id },
          data: {
            base_price: effectiveBasePrice,
            ...(override?.sku ? { sku: override.sku } : {}),
            updated_by: adminId ?? null,
          },
        });
      }

      return tx.variantUnitPrice.findMany({
        where: { variant_id: variantId, deleted_at: null },
        include: variantUnitPriceInclude,
        orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
      });
    });
  },

  async softDeleteByUuid(uuid: string, adminId?: bigint | null) {
    const existing = await this.findByUuid(uuid);
    if (!existing) return null;

    return db.variantUnitPrice.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        deleted_at: new Date(),
        // Free the unique SKU so the next row - including a regenerated
        // {item}-{color}-{size} SKU - can take it back.
        sku: retireUniqueValue(existing.sku, existing.id, 100),
        ...(adminId ? { updated_by: adminId } : {}),
      },
    });
  },

  /**
   * An archived row still occupies uniq_vup_variant_size for its (variant, size)
   * pair, which no amount of renaming can free. Re-adding that size therefore
   * revives the archived row instead of inserting a second one, which also keeps
   * its order and inventory history attached.
   */
  async findDeletedByVariantAndSize(variantId: bigint, attributeValueId: bigint) {
    return db.variantUnitPrice.findFirst({
      where: {
        variant_id: variantId,
        attribute_value_id: attributeValueId,
        deleted_at: { not: null },
      },
      orderBy: { deleted_at: "desc" },
    });
  },

  /**
   * Brings an archived row back as if it were newly created: the caller's values
   * overwrite every field, and stock restarts from the request rather than from
   * whatever was on hand when the row was archived.
   */
  async reviveById(
    id: bigint,
    data: Omit<Prisma.VariantUnitPriceUncheckedCreateInput, "uuid" | "variant_id">
  ) {
    return db.variantUnitPrice.update({
      where: { id },
      data: { ...data, deleted_at: null },
      include: variantUnitPriceInclude,
    });
  },

  async findPriceHistoryByUnitPriceId(
    variantUnitPriceId: bigint,
    params: GetVariantPriceHistoryParams
  ) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const sortOrder = params.sortOrder ?? "desc";

    const where: Prisma.variant_price_historyWhereInput = {
      variant_unit_price_id: variantUnitPriceId,
      is_active: true,
    };

    if (params.fromDate || params.toDate) {
      where.changed_at = {};
      if (params.fromDate) {
        const fromStr = params.fromDate.includes("T")
          ? params.fromDate
          : `${params.fromDate}T00:00:00.000Z`;
        where.changed_at.gte = new Date(fromStr);
      }
      if (params.toDate) {
        const toStr = params.toDate.includes("T")
          ? params.toDate
          : `${params.toDate}T23:59:59.999Z`;
        where.changed_at.lte = new Date(toStr);
      }
    }

    const [data, total] = await Promise.all([
      db.variant_price_history.findMany({
        where,
        include: {
          users_variant_price_history_created_byTousers: {
            select: {
              id: true,
              uuid: true,
              name: true,
            },
          },
        },
        orderBy: [{ changed_at: sortOrder }, { id: sortOrder }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.variant_price_history.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async findPriceHistoryAllByUnitPriceId(variantUnitPriceId: bigint) {
    return db.variant_price_history.findMany({
      where: {
        variant_unit_price_id: variantUnitPriceId,
        is_active: true,
      },
      orderBy: [{ changed_at: "asc" }, { id: "asc" }],
    });
  },
};
