import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { itemRepository } from "../repositories/item.repository";
import { styleRepository } from "@/features/styles/repositories/style.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import type { Prisma } from "@/generated/prisma";
import type { AdminItemResponse, GetAdminItemsParams } from "../types";
import type { CreateAdminItemInput, UpdateAdminItemInput } from "../validations/admin-item.schema";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

type ItemWithRollups = {
  id: bigint;
  uuid: string;
  styleId: bigint;
  name: string;
  slug: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  base_price: Prisma.Decimal | number;
  is_featured: boolean;
  is_default: boolean;
  isActive: boolean;
  out_of_stock: boolean;
  createdAt: Date;
  updatedAt: Date;
  style?: { uuid: string | null; name: string; slug?: string | null } | null;
  variants?: Array<{
    color_name: string | null;
    variant_unit_prices: Array<{
      base_price: Prisma.Decimal | number;
      inventories: { quantity_available: number } | null;
    }>;
  }>;
  item_attribute_values?: Array<{
    attribute_values: {
      uuid: string | null;
      value: string;
      color_hex: string | null;
      image_url: string | null;
    };
    product_attributes: {
      id: bigint;
      uuid: string | null;
      name: string;
      slug: string;
      type: string;
      multiple_selection: boolean;
    };
  }>;
};

function formatAdminItemResponse(item: ItemWithRollups): AdminItemResponse {
  const colorNames = new Set<string>();
  const sizePrices: number[] = [];
  let totalStock = 0;
  let sizeCount = 0;

  for (const variant of item.variants ?? []) {
    if (variant.color_name) colorNames.add(variant.color_name);
    for (const unitPrice of variant.variant_unit_prices) {
      sizeCount += 1;
      sizePrices.push(Number(unitPrice.base_price ?? 0));
      totalStock += unitPrice.inventories?.quantity_available ?? 0;
    }
  }

  let selectedColorValueCount = 0;
  let selectedOtherValueCount = 0;
  const selectedByAttribute = new Map<string, {
    id: string;
    name: string;
    slug: string;
    type: "text" | "color";
    multipleSelection: boolean;
    values: { id: string; value: string; colorHex: string | null; imageUrl: string | null }[];
  }>();
  for (const iav of item.item_attribute_values ?? []) {
    const attr = iav.product_attributes;
    const attrId = attr.uuid ?? String(attr.id);
    let group = selectedByAttribute.get(attrId);
    if (!group) {
      group = {
        id: attrId,
        name: attr.name,
        slug: attr.slug,
        type: (attr.type as "text" | "color") ?? "text",
        multipleSelection: Boolean(attr.multiple_selection),
        values: [],
      };
      selectedByAttribute.set(attrId, group);
    }
    const valueUuid = iav.attribute_values.uuid ?? "";
    group.values.push({
      id: valueUuid || `v-${group.values.length}`,
      value: iav.attribute_values.value,
      colorHex: iav.attribute_values.color_hex,
      imageUrl: iav.attribute_values.image_url,
    });
    if (attr.type === "color") selectedColorValueCount += 1;
    else selectedOtherValueCount += 1;
  }

  const selectedAttributes = Array.from(selectedByAttribute.values());

  return {
    id: item.uuid,
    styleId: item.style?.uuid ?? String(item.styleId),
    styleName: item.style?.name ?? "",
    styleSlug: item.style?.slug ?? "",
    name: item.name,
    slug: item.slug,
    sku: item.sku,
    shortDescription: item.short_description,
    description: item.description,
    basePrice: Number(item.base_price ?? 0),
    isFeatured: Boolean(item.is_featured),
    isDefault: Boolean(item.is_default),
    isActive: Boolean(item.isActive),
    outOfStock: Boolean(item.out_of_stock),
    colorCount: colorNames.size,
    sizeCount,
    selectedColorValueCount,
    selectedOtherValueCount,
    selectedAttributes,
    minPrice: sizePrices.length ? Math.min(...sizePrices) : null,
    maxPrice: sizePrices.length ? Math.max(...sizePrices) : null,
    totalStock,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

export const itemService = {
  async createAdminItem(
    styleUuid: string,
    data: CreateAdminItemInput,
    adminEmail?: string
  ): Promise<AdminItemResponse> {
    const adminId = await getAdminInternalId(adminEmail);

    const style = await styleRepository.findByUuid(styleUuid);
    if (!style || style.deleted_at !== null) {
      throw ApiError.notFound("Style not found");
    }

    // Duplicate checks look at active items only - a soft-deleted item stays
    // archived as-is and is never restored or reused, so the same code/SKU can
    // be issued again as a brand new record.
    const itemSlug = slugify(data.slug).substring(0, 220);
    const existingSlug = await itemRepository.findBySlug(itemSlug);
    if (existingSlug) {
      throw ApiError.conflict(`An active item with slug '${data.slug}' already exists`);
    }

    const itemSku = data.sku ?? null;
    if (itemSku) {
      const existingSku = await itemRepository.findBySku(itemSku);
      if (existingSku) {
        throw ApiError.conflict(`An active item with SKU '${itemSku}' already exists`);
      }
    }

    const existingCount = await itemRepository.countActiveByStyleId(style.id);
    const isDefault = data.isDefault ?? existingCount === 0;

    const created = await itemRepository.create({
      uuid: crypto.randomUUID(),
      styleId: style.id,
      name: data.name,
      slug: itemSlug,
      sku: itemSku,
      short_description: data.shortDescription ?? null,
      description: data.description ?? null,
      base_price: data.basePrice ?? 0,
      is_featured: data.isFeatured ?? false,
      is_default: isDefault,
      isActive: data.isActive ?? false,
      out_of_stock: data.outOfStock ?? false,
      created_by: adminId,
      updated_by: adminId,
    });

    return formatAdminItemResponse(created);
  },

  async getAdminItems(styleUuid: string, params: GetAdminItemsParams = {}) {
    const style = await styleRepository.findByUuid(styleUuid);
    if (!style || style.deleted_at !== null) {
      throw ApiError.notFound("Style not found");
    }

    const result = await itemRepository.findAllByStyleId(style.id, params);
    return {
      data: result.data.map(formatAdminItemResponse),
      meta: result.meta,
    };
  },

  async getAdminItemByUuid(styleUuid: string, itemUuid: string): Promise<AdminItemResponse> {
    const style = await styleRepository.findByUuid(styleUuid);
    if (!style || style.deleted_at !== null) {
      throw ApiError.notFound("Style not found");
    }

    const item = await itemRepository.findByUuid(itemUuid);
    if (!item || item.styleId !== style.id) {
      throw ApiError.notFound("Item not found for this style");
    }

    return formatAdminItemResponse(item);
  },

  async getItemByUuid(itemUuid: string): Promise<AdminItemResponse> {
    const item = await itemRepository.findByUuid(itemUuid);
    if (!item) {
      throw ApiError.notFound("Item not found");
    }
    return formatAdminItemResponse(item);
  },

  async updateAdminItem(
    styleUuid: string,
    itemUuid: string,
    data: UpdateAdminItemInput,
    adminEmail?: string
  ): Promise<AdminItemResponse> {
    const style = await styleRepository.findByUuid(styleUuid);
    if (!style || style.deleted_at !== null) {
      throw ApiError.notFound("Style not found");
    }

    const existing = await itemRepository.findByUuid(itemUuid);
    if (!existing || existing.styleId !== style.id) {
      throw ApiError.notFound("Item not found for this style");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updateData: Prisma.ItemUncheckedUpdateInput = {};

    if (adminId) updateData.updated_by = adminId;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.shortDescription !== undefined) updateData.short_description = data.shortDescription;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.basePrice !== undefined) updateData.base_price = data.basePrice;
    if (data.isFeatured !== undefined) updateData.is_featured = data.isFeatured;
    if (data.isDefault !== undefined) updateData.is_default = data.isDefault;
    if (typeof data.isActive === "boolean") updateData.isActive = data.isActive;
    if (typeof data.outOfStock === "boolean") updateData.out_of_stock = data.outOfStock;

    if (data.slug !== undefined) {
      const normalizedSlug = slugify(data.slug).substring(0, 220);
      const slugConflict = await itemRepository.findBySlug(normalizedSlug, itemUuid);
      if (slugConflict) {
        throw ApiError.conflict(`An active item with slug '${data.slug}' already exists`);
      }
      updateData.slug = normalizedSlug;
    }

    if (data.sku) {
      const skuConflict = await itemRepository.findBySku(data.sku, itemUuid);
      if (skuConflict) {
        throw ApiError.conflict(`An active item with SKU '${data.sku}' already exists`);
      }
    }

    const updated = await itemRepository.updateByUuid(itemUuid, updateData, adminId);
    if (!updated) {
      throw ApiError.notFound("Item not found");
    }

    return formatAdminItemResponse(updated);
  },

  /**
   * Resolves a Style UUID to its default (or first) active Item's UUID - lets
   * routes that were written against the old flat Style->Variant shape
   * (before this Item level existed) keep working unchanged for the common
   * case of one Item per Style, without every caller having to pick an Item
   * explicitly.
   */
  async resolveDefaultItemUuid(styleUuid: string): Promise<string> {
    const style = await styleRepository.findByUuid(styleUuid);
    if (!style || style.deleted_at !== null) {
      throw ApiError.notFound("Style not found");
    }

    const result = await itemRepository.findAllByStyleId(style.id, { pageSize: 1 });
    const defaultItem = result.data.find((i) => i.is_default) ?? result.data[0] ?? null;
    if (!defaultItem) {
      throw ApiError.notFound("This style has no items yet");
    }
    return defaultItem.uuid;
  },

  async deleteAdminItem(styleUuid: string, itemUuid: string, adminEmail?: string) {
    const style = await styleRepository.findByUuid(styleUuid);
    if (!style || style.deleted_at !== null) {
      throw ApiError.notFound("Style not found");
    }

    const existing = await itemRepository.findByUuid(itemUuid);
    if (!existing || existing.styleId !== style.id) {
      throw ApiError.notFound("Item not found for this style");
    }

    const adminId = await getAdminInternalId(adminEmail);
    await itemRepository.softDeleteByUuid(itemUuid, adminId);

    return { success: true, message: "Item deleted successfully" };
  },
};
