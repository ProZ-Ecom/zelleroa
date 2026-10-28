import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import type { variation_level_enum } from "@/generated/prisma";
import { retireUniqueValue } from "@/lib/utils/retire-unique-value";
import type { GetAdminAttributesParams } from "../types";

const attributeInclude = Prisma.validator<Prisma.ProductAttributeInclude>()({
  values: { where: { is_active: true }, orderBy: { value: "asc" } },
});

export const attributeRepository = {
  async findByUuid(uuid: string) {
    return db.productAttribute.findFirst({
      where: { uuid, is_active: true },
      include: attributeInclude,
    });
  },

  async findById(id: number | bigint) {
    return db.productAttribute.findFirst({
      where: { id: BigInt(id), is_active: true },
      include: attributeInclude,
    });
  },

  async findBySlug(slug: string, excludeUuid?: string) {
    return db.productAttribute.findFirst({
      where: {
        slug,
        is_active: true,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findByName(name: string, excludeUuid?: string) {
    return db.productAttribute.findFirst({
      where: {
        name,
        is_active: true,
        ...(excludeUuid ? { uuid: { not: excludeUuid } } : {}),
      },
    });
  },

  async findAdminAll(params: GetAdminAttributesParams = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;

    const where: Prisma.ProductAttributeWhereInput = { is_active: true };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { slug: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.productAttribute.findMany({
        where,
        include: attributeInclude,
        orderBy: [{ name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.productAttribute.count({ where }),
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

  async create(data: Prisma.ProductAttributeUncheckedCreateInput) {
    return db.productAttribute.create({ data, include: attributeInclude });
  },

  async updateByUuid(uuid: string, data: Prisma.ProductAttributeUncheckedUpdateInput) {
    const existing = await db.productAttribute.findFirst({ where: { uuid } });
    if (!existing) return null;

    return db.productAttribute.update({
      where: { id: existing.id },
      data,
      include: attributeInclude,
    });
  },

  async softDeleteByUuid(uuid: string, adminId?: bigint | null) {
    const existing = await db.productAttribute.findFirst({ where: { uuid } });
    if (!existing) return null;

    return db.productAttribute.update({
      where: { id: existing.id },
      data: {
        is_active: false,
        // Free up the unique slug so a new attribute can reuse it; the
        // deleted row keeps a namespaced slug instead of blocking inserts.
        slug: retireUniqueValue(existing.slug, existing.id, 120),
        ...(adminId ? { updated_by: adminId } : {}),
      },
    });
  },

  async createValue(
    attributeId: bigint,
    value: string,
    adminId?: bigint | null,
    priceAdjustment?: number,
    colorHex?: string | null,
    imageUrl?: string | null
  ) {
    return db.attributeValue.create({
      data: {
        uuid: crypto.randomUUID(),
        attributeId,
        value,
        color_hex: colorHex ?? null,
        image_url: imageUrl ?? null,
        price_adjustment: priceAdjustment ?? 0,
        created_by: adminId ?? undefined,
        updated_by: adminId ?? undefined,
      },
    });
  },

  async findValueByUuid(uuid: string) {
    return db.attributeValue.findFirst({ where: { uuid, is_active: true } });
  },

  async updateValueByUuid(
    uuid: string,
    value: string | undefined,
    adminId?: bigint | null,
    priceAdjustment?: number,
    colorHex?: string | null,
    imageUrl?: string | null
  ) {
    const existing = await db.attributeValue.findFirst({ where: { uuid } });
    if (!existing) return null;

    return db.attributeValue.update({
      where: { id: existing.id },
      data: {
        ...(value !== undefined ? { value } : {}),
        ...(priceAdjustment !== undefined ? { price_adjustment: priceAdjustment } : {}),
        ...(colorHex !== undefined ? { color_hex: colorHex } : {}),
        ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
        updated_by: adminId ?? undefined,
      },
    });
  },

  async softDeleteValueByUuid(uuid: string, adminId?: bigint | null) {
    const existing = await db.attributeValue.findFirst({ where: { uuid } });
    if (!existing) return null;

    return db.attributeValue.update({
      where: { id: existing.id },
      data: { is_active: false, updated_by: adminId ?? undefined },
    });
  },

  async findAllActive() {
    return db.productAttribute.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
    });
  },

  async setAttributesForProduct(
    productId: bigint,
    entries: {
      attributeId: bigint;
      isRequired: boolean;
      sortOrder: number;
      variationLevel: variation_level_enum;
    }[]
  ) {
    try {
      await db.$transaction([
        db.product_attribute_configs.deleteMany({ where: { product_id: productId } }),
        ...(entries.length
          ? [
              db.product_attribute_configs.createMany({
                data: entries.map((e) => ({
                  product_id: productId,
                  attribute_id: e.attributeId,
                  is_required: e.isRequired,
                  sort_order: e.sortOrder,
                  variation_level: e.variationLevel,
                })),
              }),
            ]
          : []),
      ]);
    } catch (err: any) {
      console.warn("[attributeRepository.setAttributesForProduct] product_attribute_configs table not available:", err?.message);
    }
  },

  async findAttributeConfigsForProduct(productId: bigint) {
    try {
      return await db.product_attribute_configs.findMany({
        where: { product_id: productId },
        orderBy: { sort_order: "asc" },
        include: {
          product_attributes: {
            include: {
              values: { where: { is_active: true }, orderBy: { value: "asc" } },
            },
          },
        },
      });
    } catch (err: any) {
      console.warn("[attributeRepository.findAttributeConfigsForProduct] product_attribute_configs table not available:", err?.message);
      return [];
    }
  },

  async countProductAttributeUsage(productId: bigint, attributeId: bigint) {
    const [itemCount, variantCount, skuCount] = await Promise.all([
      db.item.count({
        where: {
          style: { productId },
          isActive: true,
          deleted_at: null,
          item_attribute_values: { some: { attribute_id: attributeId } },
        },
      }),
      db.productVariant.count({
        where: {
          item: { style: { productId } },
          isActive: true,
          variant_attribute_values: { some: { attribute_id: attributeId } },
        },
      }),
      // Stock rows whose identity includes this attribute. Demoting it off the SKU
      // axis leaves these rows describing a variation the product no longer declares,
      // so the admin is warned with a real number rather than a guess.
      db.variantUnitPrice.count({
        where: {
          deleted_at: null,
          variant: { item: { style: { productId } } },
          vup_attribute_values: { some: { attribute_id: attributeId } },
        },
      }),
    ]);
    return { itemCount, variantCount, skuCount };
  },

  async setAttributeValuesForItem(
    itemId: bigint,
    entries: { attributeId: bigint; attributeValueId: bigint }[]
  ) {
    await db.$transaction([
      db.item_attribute_values.deleteMany({ where: { item_id: itemId } }),
      ...(entries.length
        ? [
            db.item_attribute_values.createMany({
              data: entries.map((e) => ({
                item_id: itemId,
                attribute_id: e.attributeId,
                attribute_value_id: e.attributeValueId,
              })),
            }),
          ]
        : []),
    ]);
  },

  async findAttributeValuesForItem(itemId: bigint) {
    return db.item_attribute_values.findMany({
      where: { item_id: itemId },
      include: { attribute_values: true, product_attributes: true },
    });
  },
};
