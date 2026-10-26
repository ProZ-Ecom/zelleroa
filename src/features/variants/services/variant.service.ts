import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { variantRepository } from "../repositories/variant.repository";
import { itemRepository } from "@/features/items/repositories/item.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import { unitRepository } from "@/features/units/repositories/unit.repository";
import { attributeRepository } from "@/features/attributes/repositories/attribute.repository";
import { formatVariantMeasurement } from "../utils/measurement.util";
import {
  buildAttributeSignature,
  MAX_GENERATED_SKUS,
  MAX_SKU_AXIS_ATTRIBUTES,
} from "../utils/attribute-signature.util";
import type { Prisma, variation_level_enum } from "@/generated/prisma";
import type {
  AdminVariantResponse,
  AdminVariantAttributeValueResponse,
  VariantUnitPriceResponse,
  GetAdminVariantsParams,
  AdminVariantListParams,
  AdminVariantsCountResponse,
  GenerateVariantsResponse,
  PreviewGenerateVariantsResponse,
} from "../types";
import type {
  CreateAdminVariantInput,
  UpdateAdminVariantInput,
  GenerateVariantsInput,
  GenerateVariantOptionInput,
  ApplyVariantRemovalsInput,
} from "../validations/admin-variant.schema";

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

/**
 * Which axis each of a product's attributes varies on, keyed by attribute id.
 *
 * The level comes from the product's own configuration, not from the attribute's
 * `type` - `type` only says how to render a value (a swatch or a chip), and keying
 * generation off it meant a catalog holding both "Colour" (type color) and "Color"
 * (type text) silently put them on different axes.
 *
 * An attribute selected without being configured on the product falls back to SKU,
 * matching the column default.
 */
async function variationLevelsForProduct(
  productId: bigint
): Promise<Map<string, { level: variation_level_enum; sortOrder: number }>> {
  const configs = await attributeRepository.findAttributeConfigsForProduct(productId);
  return new Map(
    configs.map((config) => [
      config.attribute_id.toString(),
      { level: config.variation_level, sortOrder: config.sort_order },
    ])
  );
}

/**
 * The value that goes in `variant_unit_prices.attribute_value_id`: the SKU-axis value
 * whose attribute sorts first on the product. The column no longer carries the row's
 * identity (the signature does), but labels, size charts and a lot of existing reads
 * still go through it, so it needs to be the same pick every time.
 */
function primarySkuValue<T extends { sortOrder: number; valueId: bigint }>(
  combo: readonly T[]
): T | undefined {
  return [...combo].sort(
    (a, b) => a.sortOrder - b.sortOrder || (a.valueId < b.valueId ? -1 : 1)
  )[0];
}

function cartesian<T>(groups: T[][]): T[][] {
  let combos: T[][] = [[]];
  for (const group of groups) {
    const next: T[][] = [];
    for (const combo of combos) {
      for (const value of group) {
        next.push([...combo, value]);
      }
    }
    combos = next;
  }
  return combos;
}

type VariantUnitPriceWithRelations = {
  id: bigint;
  uuid: string;
  variant_id: bigint;
  sku: string;
  base_price: Prisma.Decimal | number;
  unit_value: Prisma.Decimal | number;
  unit_id: bigint;
  is_default: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  product_units?: { uuid: string | null; name: string; code: string; type?: string | null } | null;
  attribute_value?: { uuid: string | null; value: string } | null;
  inventories?: { quantity_available: number; quantity_reserved: number } | null;
};

export function formatUnitPriceResponse(
  variantUuid: string,
  item: VariantUnitPriceWithRelations
): VariantUnitPriceResponse {
  const unitUuid = item.product_units?.uuid || String(item.unit_id);
  const measurement = formatVariantMeasurement(
    {
      type: item.product_units?.type,
      code: item.product_units?.code,
      uuid: unitUuid,
    },
    item.unit_value,
    unitUuid
  );

  return {
    id: item.uuid,
    variantId: variantUuid,
    sku: item.sku,
    basePrice: Number(item.base_price),
    measurement,
    unitId: unitUuid,
    unitValue: Number(item.unit_value),
    unitName: item.product_units?.name,
    unitCode: item.product_units?.code,
    sizeValueId: item.attribute_value?.uuid ?? undefined,
    sizeValue: item.attribute_value?.value ?? undefined,
    attributeValues: (item.vup_attribute_values ?? []).map((av) => ({
      attributeId: av.product_attributes.uuid || "",
      attributeName: av.product_attributes.name,
      valueId: av.attribute_values.uuid || "",
      value: av.attribute_values.value,
    })),
    isDefault: Boolean(item.is_default),
    isActive: Boolean(item.isActive),
    stock: item.inventories?.quantity_available,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function formatAdminVariantResponse(
  variant: {
    id: bigint;
    uuid: string;
    itemId: bigint;
    variant_name?: string | null;
    slug?: string | null;
    color_name?: string | null;
    color_hex?: string | null;
    price_adjustment?: Prisma.Decimal | number | null;
    is_featured?: boolean;
    isActive: boolean;
    out_of_stock?: boolean;
    createdAt: Date;
    updatedAt: Date;
    item?: {
      uuid: string | null;
      name: string;
      slug?: string | null;
      base_price?: Prisma.Decimal | number | null;
    } | null;
    product_variant_images?: Array<{ image_url: string; is_primary: boolean }> | null;
    variant_unit_prices?: VariantUnitPriceWithRelations[] | null;
    variant_attribute_values?: Array<{
      product_attributes: { uuid: string | null; name: string; slug: string };
      attribute_values: { uuid: string | null; value: string; price_adjustment?: Prisma.Decimal | number | null };
    }> | null;
  },
  cachedItemUuid?: string,
  cachedItemName?: string
): AdminVariantResponse {
  const variantUuid = variant.uuid;
  const itemUuid = cachedItemUuid ?? variant.item?.uuid ?? String(variant.itemId);
  const itemName = cachedItemName || variant.item?.name || "";
  const itemSlug = variant.item?.slug || "";
  const variantName = variant.variant_name || "";

  const primaryImgObj =
    variant.product_variant_images?.find((img) => img.is_primary) ??
    variant.product_variant_images?.[0];
  const primaryImage = primaryImgObj ? primaryImgObj.image_url : null;

  const unitPrices = (variant.variant_unit_prices || []).map((up) =>
    formatUnitPriceResponse(variantUuid, up)
  );

  const defaultUnitPrice =
    unitPrices.find((up) => up.isDefault) ?? unitPrices[0] ?? undefined;

  const totalStock = unitPrices.reduce(
    (sum, up) => (up.stock !== undefined ? sum + up.stock : sum),
    0
  );

  const attributeValues: AdminVariantAttributeValueResponse[] = (
    variant.variant_attribute_values || []
  ).map((vav) => ({
    attributeId: vav.product_attributes.uuid || "",
    attributeName: vav.product_attributes.name,
    attributeSlug: vav.product_attributes.slug,
    valueId: vav.attribute_values.uuid || "",
    value: vav.attribute_values.value,
    priceAdjustment: Number(vav.attribute_values.price_adjustment ?? 0),
  }));

  return {
    id: variantUuid,
    itemId: itemUuid,
    itemName,
    itemSlug,
    productId: itemUuid,
    productName: itemName,
    productSlug: itemSlug,
    variantName,
    slug: variant.slug || "",
    colorName: variant.color_name ?? null,
    colorHex: variant.color_hex ?? null,
    priceAdjustment: Number(variant.price_adjustment ?? 0),
    itemPrice: variant.item?.base_price != null ? Number(variant.item.base_price) : undefined,
    isFeatured: Boolean(variant.is_featured),
    primaryImage,
    isActive: Boolean(variant.isActive),
    // Zero total stock always reads as out of stock, whatever the stored flag says.
    outOfStock: Boolean(variant.out_of_stock) || (unitPrices.length > 0 && totalStock <= 0),
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
    unitPrices,
    attributeValues,
    // Backward-compatible convenience fields mirrored from the default unit price
    measurement: defaultUnitPrice?.measurement,
    sku: defaultUnitPrice?.sku,
    basePrice: defaultUnitPrice?.basePrice,
    salePrice: defaultUnitPrice?.basePrice,
    stock: unitPrices.length > 0 ? totalStock : undefined,
    unitId: defaultUnitPrice?.unitId,
    unitValue: defaultUnitPrice?.unitValue,
    unitName: defaultUnitPrice?.unitName,
    unitCode: defaultUnitPrice?.unitCode,
  };
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

async function resolveAttributeValueInternalIds(uuids: string[]): Promise<bigint[]> {
  if (!uuids.length) return [];
  const values = await db.attributeValue.findMany({
    where: { uuid: { in: uuids }, is_active: true },
    select: { id: true },
  });
  return values.map((v) => v.id);
}

/**
 * Color is no longer entered by hand on the variant - it's derived from
 * whichever of the selected attribute values belongs to a Color-type
 * attribute (Attribute Master), keeping the hex code single-sourced there.
 */
async function resolveColorFromAttributeValueIds(
  internalIds: bigint[]
): Promise<{ colorName: string | null; colorHex: string | null }> {
  if (!internalIds.length) return { colorName: null, colorHex: null };
  const colorValue = await db.attributeValue.findFirst({
    where: { id: { in: internalIds }, attribute: { type: "color" } },
    select: { value: true, color_hex: true },
  });
  return { colorName: colorValue?.value ?? null, colorHex: colorValue?.color_hex ?? null };
}

/**
 * Rejects a variant whose attribute combination (e.g. Color=Red, Fabric=Cotton)
 * exactly matches another active Color variant of the same Item. A variant with
 * no attributes at all (Item has no Color/Fabric configured) is exempt - that's
 * the normal single-variant case, not a duplicate. Two different Items of the
 * same Product may legitimately share a combination (e.g. both have "Red").
 */
async function assertNoDuplicateAttributeCombination(
  itemId: bigint,
  attributeValueInternalIds: bigint[],
  excludeVariantId?: bigint
): Promise<void> {
  if (attributeValueInternalIds.length === 0) return;

  const sortedNew = [...attributeValueInternalIds].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  const existingSets = await variantRepository.findAttributeSetsForItem(
    itemId,
    excludeVariantId
  );

  const duplicate = existingSets.some(
    (existing) =>
      existing.attributeValueIds.length === sortedNew.length &&
      existing.attributeValueIds.every((id, i) => id === sortedNew[i])
  );

  if (duplicate) {
    throw ApiError.conflict(
      "Another Color on this Item already has this exact combination of attributes"
    );
  }
}

export const variantService = {
  async createAdminVariant(
    itemUuid: string,
    data: CreateAdminVariantInput,
    adminEmail?: string
  ): Promise<AdminVariantResponse> {
    const adminId = await getAdminInternalId(adminEmail);

    // 1. Resolve & Validate Item
    const item = await itemRepository.findByUuid(itemUuid);
    if (!item || item.deleted_at !== null) {
      throw ApiError.notFound("Item not found");
    }

    // 2. Validate Slug
    const variantSlug = slugify(data.slug).substring(0, 250);
    const existingSlug = await variantRepository.findBySlug(variantSlug);
    if (existingSlug) {
      throw ApiError.conflict(`An active variant with slug '${data.slug}' already exists`);
    }

    // 2b. Reject a duplicate attribute combination before writing anything.
    const newAttributeValueIds = data.attributeValueIds
      ? await resolveAttributeValueInternalIds(data.attributeValueIds)
      : [];
    await assertNoDuplicateAttributeCombination(item.id, newAttributeValueIds);
    const { colorName, colorHex } = await resolveColorFromAttributeValueIds(newAttributeValueIds);

    // 3. Create Variant (Color level only; unit/price/size combos are managed
    // separately via variantUnitPriceService)
    const variant = await variantRepository.create({
      uuid: crypto.randomUUID(),
      itemId: item.id,
      variant_name: data.variantName || colorName || "Default",
      slug: variantSlug,
      color_name: colorName,
      color_hex: colorHex,
      price_adjustment: data.priceAdjustment ?? 0,
      is_featured: data.isFeatured ?? false,
      isActive: data.isActive !== undefined ? data.isActive : false,
      out_of_stock: data.outOfStock !== undefined ? data.outOfStock : false,
      created_by: adminId,
      updated_by: adminId,
    });

    if (data.attributeValueIds !== undefined) {
      await variantRepository.setAttributeValuesForVariant(variant.id, newAttributeValueIds);
    }

    const withAttributes = await variantRepository.findByUuid(variant.uuid);
    return formatAdminVariantResponse(
      withAttributes || variant,
      item.uuid || itemUuid,
      item.name
    );
  },

  async getAllAdminVariants(params: AdminVariantListParams = {}) {
    const result = await variantRepository.findAdminVariants(params);
    const data = result.data.map((item) => formatAdminVariantResponse(item));

    return {
      data,
      meta: result.meta,
    };
  },

  async countAdminVariants(
    params: AdminVariantListParams = {}
  ): Promise<AdminVariantsCountResponse> {
    return variantRepository.countAdminVariants(params);
  },

  async getAdminVariants(
    itemUuid: string,
    params: GetAdminVariantsParams = {}
  ) {
    const item = await itemRepository.findByUuid(itemUuid);
    if (!item || item.deleted_at !== null) {
      throw ApiError.notFound("Item not found");
    }

    const result = await variantRepository.findAdminAllByItemId(item.id, params);
    const data = result.data.map((v) =>
      formatAdminVariantResponse(v, item.uuid || itemUuid, item.name)
    );

    return {
      data,
      meta: result.meta,
    };
  },

  async getAdminVariantByUuid(
    itemUuid: string,
    variantUuid: string
  ): Promise<AdminVariantResponse> {
    const item = await itemRepository.findByUuid(itemUuid);
    if (!item || item.deleted_at !== null) {
      throw ApiError.notFound("Item not found");
    }

    const variant = await variantRepository.findByUuid(variantUuid);
    if (!variant || variant.itemId !== item.id) {
      throw ApiError.notFound("Variant not found for this item");
    }

    return formatAdminVariantResponse(variant, item.uuid || itemUuid, item.name);
  },

  async getVariantByUuid(variantUuid: string): Promise<AdminVariantResponse> {
    const variant = await variantRepository.findByUuid(variantUuid);
    if (!variant || variant.deleted_at !== null) {
      throw ApiError.notFound("Variant not found");
    }

    return formatAdminVariantResponse(variant);
  },

  async updateAdminVariant(
    itemUuid: string,
    variantUuid: string,
    data: UpdateAdminVariantInput,
    adminEmail?: string
  ): Promise<AdminVariantResponse> {
    const item = await itemRepository.findByUuid(itemUuid);
    if (!item || item.deleted_at !== null) {
      throw ApiError.notFound("Item not found");
    }

    const existing = await variantRepository.findByUuid(variantUuid);
    if (!existing || existing.itemId !== item.id) {
      throw ApiError.notFound("Variant not found for this item");
    }

    const adminId = await getAdminInternalId(adminEmail);

    if (data.isActive === true) {
      const activePriceCount = await db.variantUnitPrice.count({
        where: {
          variant_id: existing.id,
          deleted_at: null,
          isActive: true,
          base_price: { gt: 0 },
        },
      });
      if (activePriceCount === 0) {
        throw ApiError.badRequest(
          "Cannot activate item without price details. Please add at least one unit price first."
        );
      }
    }

    const updateData = buildVariantUpdateData(data, adminId);

    if (data.slug !== undefined) {
      const normalizedSlug = slugify(data.slug).substring(0, 250);
      const slugConflict = await variantRepository.findBySlug(normalizedSlug, variantUuid);
      if (slugConflict) {
        throw ApiError.conflict(`A variant with slug '${data.slug}' already exists`);
      }
      updateData.slug = normalizedSlug;
    }

    let updateAttributeValueIds: bigint[] | undefined;
    if (data.attributeValueIds !== undefined) {
      updateAttributeValueIds = await resolveAttributeValueInternalIds(data.attributeValueIds);
      await assertNoDuplicateAttributeCombination(
        item.id,
        updateAttributeValueIds,
        existing.id
      );
      const { colorName, colorHex } = await resolveColorFromAttributeValueIds(
        updateAttributeValueIds
      );
      updateData.color_name = colorName;
      updateData.color_hex = colorHex;
    }

    const updated = await variantRepository.updateByUuid(variantUuid, updateData, adminId);
    if (!updated) {
      throw ApiError.notFound("Variant not found");
    }

    if (updateAttributeValueIds !== undefined) {
      await variantRepository.setAttributeValuesForVariant(updated.id, updateAttributeValueIds);
    }

    const withAttributes = await variantRepository.findByUuid(variantUuid);
    return formatAdminVariantResponse(
      withAttributes || updated,
      item.uuid || itemUuid,
      item.name
    );
  },

  async updateVariantByUuid(
    variantUuid: string,
    data: UpdateAdminVariantInput,
    adminEmail?: string
  ): Promise<AdminVariantResponse> {
    const existing = await variantRepository.findByUuid(variantUuid);
    if (!existing || existing.deleted_at !== null) {
      throw ApiError.notFound("Variant not found");
    }

    const adminId = await getAdminInternalId(adminEmail);

    if (data.isActive === true) {
      const activePriceCount = await db.variantUnitPrice.count({
        where: {
          variant_id: existing.id,
          deleted_at: null,
          isActive: true,
          base_price: { gt: 0 },
        },
      });
      if (activePriceCount === 0) {
        throw ApiError.badRequest(
          "Cannot activate item without price details. Please add at least one unit price first."
        );
      }
    }

    const updateData = buildVariantUpdateData(data, adminId);

    if (data.slug !== undefined) {
      const normalizedSlug = slugify(data.slug).substring(0, 250);
      const slugConflict = await variantRepository.findBySlug(normalizedSlug, variantUuid);
      if (slugConflict) {
        throw ApiError.conflict(`A variant with slug '${data.slug}' already exists`);
      }
      updateData.slug = normalizedSlug;
    }

    let updateAttributeValueIds: bigint[] | undefined;
    if (data.attributeValueIds !== undefined) {
      updateAttributeValueIds = await resolveAttributeValueInternalIds(data.attributeValueIds);
      await assertNoDuplicateAttributeCombination(
        existing.itemId,
        updateAttributeValueIds,
        existing.id
      );
      const { colorName, colorHex } = await resolveColorFromAttributeValueIds(
        updateAttributeValueIds
      );
      updateData.color_name = colorName;
      updateData.color_hex = colorHex;
    }

    const updated = await variantRepository.updateByUuid(variantUuid, updateData, adminId);
    if (!updated) {
      throw ApiError.notFound("Variant not found");
    }

    if (updateAttributeValueIds !== undefined) {
      await variantRepository.setAttributeValuesForVariant(updated.id, updateAttributeValueIds);
    }

    const withAttributes = await variantRepository.findByUuid(variantUuid);
    return formatAdminVariantResponse(withAttributes || updated);
  },

  async deleteAdminVariant(
    itemUuid: string,
    variantUuid: string,
    adminEmail?: string
  ) {
    const item = await itemRepository.findByUuid(itemUuid);
    if (!item || item.deleted_at !== null) {
      throw ApiError.notFound("Item not found");
    }

    const existing = await variantRepository.findByUuid(variantUuid);
    if (!existing || existing.itemId !== item.id) {
      throw ApiError.notFound("Variant not found for this item");
    }

    const adminId = await getAdminInternalId(adminEmail);
    await variantRepository.softDeleteByUuid(variantUuid, adminId);

    return {
      success: true,
      message: "Variant deleted successfully",
    };
  },

  async deleteVariantByUuid(variantUuid: string, adminEmail?: string) {
    const existing = await variantRepository.findByUuid(variantUuid);
    if (!existing || existing.deleted_at !== null) {
      throw ApiError.notFound("Variant not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    await variantRepository.softDeleteByUuid(variantUuid, adminId);

    return {
      success: true,
      message: "Variant deleted successfully",
    };
  },

  /**
   * Item-driven entry point: builds the `options` (attributeId + valueIds per
   * attribute) straight from item_attribute_values - the value pool the admin
   * already selected on the Item's Attributes section - instead of requiring
   * them to be re-picked in a separate "generate" dialog. Price/stock/unit
   * defaults are still supplied by the caller, same as the direct path.
   */
  async generateVariantsFromItemAttributeValues(
    itemUuid: string,
    params: {
      unitId: string;
      defaultPrice?: number;
      activate?: boolean;
    },
    adminEmail?: string
  ): Promise<GenerateVariantsResponse> {
    const item = await itemRepository.findByUuid(itemUuid);
    if (!item || item.deleted_at !== null) {
      throw ApiError.notFound("Item not found");
    }

    const selections = await attributeRepository.findAttributeValuesForItem(item.id);
    if (!selections.length) {
      throw ApiError.badRequest(
        "Select at least one attribute value for this item before generating variants"
      );
    }

    const valueIdsByAttribute = new Map<string, Set<string>>();
    for (const s of selections) {
      const attributeUuid = s.product_attributes.uuid || String(s.attribute_id);
      const valueUuid = s.attribute_values.uuid || String(s.attribute_value_id);
      if (!valueIdsByAttribute.has(attributeUuid)) {
        valueIdsByAttribute.set(attributeUuid, new Set());
      }
      valueIdsByAttribute.get(attributeUuid)!.add(valueUuid);
    }

    const options: GenerateVariantOptionInput[] = [...valueIdsByAttribute.entries()].map(
      ([attributeId, valueIds]) => ({ attributeId, valueIds: [...valueIds] })
    );

    return variantService.generateVariants(
      itemUuid,
      {
        options,
        unitId: params.unitId,
        defaultPrice: params.defaultPrice,
        activate: params.activate ?? true,
      },
      adminEmail
    );
  },

  /**
   * Cartesian-generates this Item's variations, split by each attribute's configured
   * variation level: VARIANT values combine into ProductVariants (which carry the
   * images), and within each one the SKU values combine into VariantUnitPrices - the
   * stock rows. INFO attributes take no part; they describe the Item rather than
   * varying it.
   *
   * A stock row is identified by its whole SKU combination, so Size x Neck x Sleeve
   * is three axes and eight rows, not two rows with the extra values dropped. An Item
   * with no VARIANT axis gets a single shell ProductVariant (color_name=null) carrying
   * its stock rows directly; one with no SKU axis gets a single default row per
   * variant. Combinations that already exist are skipped rather than erroring, so
   * re-running after adding one new value only creates the rows that are missing.
   *
   * Nothing is created with stock: it arrives through a purchase or an inventory
   * adjustment so that every level is backed by a ledger movement.
   */
  async generateVariants(
    itemUuid: string,
    data: GenerateVariantsInput,
    adminEmail?: string
  ): Promise<GenerateVariantsResponse> {
    const adminId = await getAdminInternalId(adminEmail);

    const item = await itemRepository.findByUuid(itemUuid);
    if (!item || item.deleted_at !== null) {
      throw ApiError.notFound("Item not found");
    }

    const unit = await unitRepository.findByUuid(data.unitId);
    if (!unit || !unit.is_active) {
      throw ApiError.badRequest("Invalid or inactive unit");
    }

    type ResolvedValue = {
      attributeId: bigint;
      attributeName: string;
      valueId: bigint;
      value: string;
      colorHex: string | null;
      priceAdjustment: number;
      sortOrder: number;
    };

    const levels = await variationLevelsForProduct(item.style.productId);

    const colorGroups: ResolvedValue[][] = [];
    const sizeGroups: ResolvedValue[][] = [];
    for (const option of data.options) {
      const attribute = await db.productAttribute.findFirst({
        where: { uuid: option.attributeId, is_active: true },
        select: { id: true, name: true, type: true },
      });
      if (!attribute) {
        throw ApiError.badRequest(`Variation option not found: ${option.attributeId}`);
      }

      const values = await db.attributeValue.findMany({
        where: {
          uuid: { in: option.valueIds },
          attributeId: attribute.id,
          is_active: true,
        },
      });
      if (values.length !== new Set(option.valueIds).size) {
        throw ApiError.badRequest(
          `One or more selected values are invalid for "${attribute.name}"`
        );
      }

      const config = levels.get(attribute.id.toString());
      const resolved = values.map((v) => ({
        attributeId: attribute.id,
        attributeName: attribute.name,
        valueId: v.id,
        value: v.value,
        colorHex: v.color_hex,
        priceAdjustment: Number(v.price_adjustment ?? 0),
        sortOrder: config?.sortOrder ?? 0,
      }));

      // An Info attribute describes the item rather than varying it, so it takes no
      // part in generation at all - its values live on item_attribute_values.
      const level = config?.level ?? "SKU";
      if (level === "INFO") continue;
      if (level === "VARIANT") {
        colorGroups.push(resolved);
      } else {
        sizeGroups.push(resolved);
      }
    }

    if (sizeGroups.length > MAX_SKU_AXIS_ATTRIBUTES) {
      throw ApiError.badRequest(
        `A stock row can carry at most ${MAX_SKU_AXIS_ATTRIBUTES} SKU attributes; this product has ${sizeGroups.length}. Move some to Info.`
      );
    }

    let colorCombinations = cartesian(colorGroups);
    let sizeCombinations = cartesian(sizeGroups);

    if (colorCombinations.length === 0) colorCombinations = [[]];
    if (sizeCombinations.length === 0) sizeCombinations = [[]];

    // Attributes multiply, so a few extra axes turn into thousands of rows. Refuse
    // up front with the real number rather than committing a catalog nobody can manage.
    const totalCombinations = colorCombinations.length * sizeCombinations.length;
    if (totalCombinations > MAX_GENERATED_SKUS) {
      throw ApiError.badRequest(
        `This would create ${totalCombinations} stock rows, over the limit of ${MAX_GENERATED_SKUS}. Move some attributes to Info, or select fewer values.`
      );
    }

    const existingVariants = await db.productVariant.findMany({
      where: { itemId: item.id, deleted_at: null },
      select: {
        id: true,
        color_name: true,
        variant_attribute_values: { select: { attribute_value_id: true } },
        variant_unit_prices: {
          where: { deleted_at: null },
          select: { attribute_signature: true },
        },
      },
    });
    const colorKey = (combo: ResolvedValue[]) =>
      combo
        .map((v) => v.valueId.toString())
        .sort()
        .join(",");
    const existingColorKeys = new Map(
      existingVariants.map((v) => [
        v.variant_attribute_values.map((x) => x.attribute_value_id.toString()).sort().join(","),
        v,
      ])
    );

    const itemSlug = item.slug || "item";
    const itemBasePrice = Number(item.base_price ?? 0);
    const createdVariantIds = new Set<bigint>();
    let skipped = 0;

    // Generating N combinations does several sequential awaited queries each
    // (SKU/slug uniqueness while-loops, inventory rows) - Prisma's 5s default
    // interactive-transaction timeout is easily exceeded once a product has
    // more than a handful of combinations, which throws an unrecognized P2028
    // that surfaces to the admin as a bare "Something went wrong".
    await db.$transaction(async (tx) => {
      for (const colorCombo of colorCombinations) {
        const cKey = colorKey(colorCombo);
        let variantId: bigint;
        let existingSignatures: Set<string>;
        let isNewColorVariant = false;

        const existingVariant = existingColorKeys.get(cKey);
        if (existingVariant) {
          variantId = existingVariant.id;
          existingSignatures = new Set(
            existingVariant.variant_unit_prices.map((up) => up.attribute_signature)
          );
        } else {
          const variantName = colorCombo.length
            ? colorCombo.map((v) => v.value).join(" / ")
            : item.name;
          const slugBase = `${itemSlug}-${
            colorCombo.length ? colorCombo.map((v) => slugify(v.value)).join("-") : "default"
          }`.slice(0, 230);
          let variantSlug = slugBase;
          let slugSuffix = 1;
          // eslint-disable-next-line no-await-in-loop
          while (
            await tx.productVariant.findFirst({ where: { slug: variantSlug, deleted_at: null } })
          ) {
            slugSuffix += 1;
            variantSlug = `${slugBase}-${slugSuffix}`;
          }

          const colorEntry = colorCombo[0];
          const created = await tx.productVariant.create({
            data: {
              uuid: crypto.randomUUID(),
              itemId: item.id,
              variant_name: variantName,
              slug: variantSlug,
              color_name: colorEntry?.value ?? null,
              color_hex: colorEntry?.colorHex ?? null,
              price_adjustment: 0,
              is_default: colorCombo.length === 0,
              isActive: data.activate !== false,
              // Nothing is generated with stock, so a new colour starts out of stock
              // and the flag is cleared by the first movement that brings some in.
              out_of_stock: true,
              created_by: adminId,
              updated_by: adminId,
            },
          });

          if (colorCombo.length > 0) {
            await tx.variant_attribute_values.createMany({
              data: colorCombo.map((v) => ({
                variant_id: created.id,
                attribute_id: v.attributeId,
                attribute_value_id: v.valueId,
              })),
            });
          }

          variantId = created.id;
          existingSignatures = new Set();
          isNewColorVariant = true;
        }

        const sizeRowsBefore = existingSignatures.size;

        for (const sizeCombo of sizeCombinations) {
          const comboTogether = [...colorCombo, ...sizeCombo];

          // The whole combination identifies the row, so Size x Neck x Sleeve are
          // three distinct rows. Keying this on one value - as it did while
          // attribute_value_id was the only place to put a value - made every
          // combination that repeated that value look like a duplicate and skipped it.
          const signature = buildAttributeSignature(sizeCombo.map((v) => v.valueId));
          if (existingSignatures.has(signature)) {
            skipped += 1;
            continue;
          }

          // Labels and size charts still read attribute_value_id, so it holds the
          // first-sorting value of the combination.
          const sizeEntry = primarySkuValue(sizeCombo);

          // Every new Color x Size starts at the Item's price - the one place
          // a price is entered. Sizes that cost more/less are changed on the
          // size table afterwards.
          const basePrice = data.defaultPrice ?? itemBasePrice;

          const skuBase =
            [skuPart(itemSlug), ...comboTogether.map((v) => skuPart(v.value))]
              .filter(Boolean)
              .join("-") || `ITEM-${variantId}`;
          let sku = skuBase;
          let skuSuffix = 1;
          // eslint-disable-next-line no-await-in-loop
          while (await tx.variantUnitPrice.findFirst({ where: { sku, deleted_at: null } })) {
            skuSuffix += 1;
            sku = `${skuBase}-${skuSuffix}`;
          }

          const unitPrice = await tx.variantUnitPrice.create({
            data: {
              uuid: crypto.randomUUID(),
              variant_id: variantId,
              unit_id: unit.id,
              unit_value: 1,
              attribute_value_id: sizeEntry?.valueId ?? null,
              attribute_signature: signature,
              sku,
              base_price: basePrice,
              is_default: !sizeEntry,
              isActive: true,
              created_by: adminId,
              updated_by: adminId,
            },
          });

          // Every value of the combination, not just the primary one - this is what
          // lets a shopper's full selection resolve back to exactly this row.
          if (sizeCombo.length > 0) {
            await tx.variant_unit_price_attribute_values.createMany({
              data: sizeCombo.map((v) => ({
                variant_unit_price_id: unitPrice.id,
                attribute_id: v.attributeId,
                attribute_value_id: v.valueId,
              })),
            });
          }

          // Generated rows always start empty; stock arrives through a purchase or an
          // inventory adjustment, so it is always backed by a ledger movement.
          await tx.inventory.create({
            data: {
              variantUnitPriceId: unitPrice.id,
              quantity_available: 0,
              quantity_reserved: 0,
              is_active: true,
              created_by: adminId,
              updated_by: adminId,
            },
          });

          existingSignatures.add(signature);
          createdVariantIds.add(variantId);
        }

        // A brand-new Color that didn't end up with a single sellable Size
        // (every pairing was a duplicate) would otherwise be
        // left behind as an empty, unsellable Color with no price - which is
        // indistinguishable from the generator having silently done nothing
        // for that color. Roll it back instead, so it never appears at all
        // and the color's combinations are honestly counted as skipped.
        if (isNewColorVariant && existingSignatures.size === sizeRowsBefore) {
          await tx.variant_attribute_values.deleteMany({ where: { variant_id: variantId } });
          await tx.productVariant.delete({ where: { id: variantId } });
        }
      }
    }, { timeout: 60000 });

    const variants = await Promise.all(
      [...createdVariantIds].map(async (id) => {
        const full = await variantRepository.findById(id);
        return formatAdminVariantResponse(full!, item.uuid || itemUuid, item.name);
      })
    );

    return { created: variants.length, skipped, variants };
  },

  /**
   * Read-only dry run for generateVariants: resolves the same Variant/SKU cartesian
   * product and reports what a real run would add, WITHOUT writing anything. Also
   * flags existing Colors/Sizes under this Item that fall outside the newly
   * selected attribute values, so the admin can see - and explicitly choose to
   * deactivate - combinations they've deselected, rather than those being silently
   * left behind or silently deleted. Existing rows are never touched here.
   */
  async previewGenerateVariants(
    itemUuid: string,
    options: GenerateVariantOptionInput[]
  ): Promise<PreviewGenerateVariantsResponse> {
    const item = await itemRepository.findByUuid(itemUuid);
    if (!item || item.deleted_at !== null) {
      throw ApiError.notFound("Item not found");
    }

    type ResolvedValue = {
      attributeId: bigint;
      attributeName: string;
      valueId: bigint;
      value: string;
    };

    const levels = await variationLevelsForProduct(item.style.productId);

    const colorGroups: ResolvedValue[][] = [];
    const sizeGroups: ResolvedValue[][] = [];
    let touchesColorAxis = false;
    let touchesSizeAxis = false;

    for (const option of options) {
      const attribute = await db.productAttribute.findFirst({
        where: { uuid: option.attributeId, is_active: true },
        select: { id: true, name: true, type: true },
      });
      if (!attribute) {
        throw ApiError.badRequest(`Variation option not found: ${option.attributeId}`);
      }

      const values = await db.attributeValue.findMany({
        where: { uuid: { in: option.valueIds }, attributeId: attribute.id, is_active: true },
      });
      if (values.length !== new Set(option.valueIds).size) {
        throw ApiError.badRequest(
          `One or more selected values are invalid for "${attribute.name}"`
        );
      }

      const resolved = values.map((v) => ({
        attributeId: attribute.id,
        attributeName: attribute.name,
        valueId: v.id,
        value: v.value,
      }));

      const level = levels.get(attribute.id.toString())?.level ?? "SKU";
      if (level === "INFO") continue;
      if (level === "VARIANT") {
        colorGroups.push(resolved);
        touchesColorAxis = true;
      } else {
        sizeGroups.push(resolved);
        touchesSizeAxis = true;
      }
    }

    const colorCombinations = cartesian(colorGroups);
    const sizeCombinations = cartesian(sizeGroups);
    const colorKey = (combo: ResolvedValue[]) =>
      combo.map((v) => v.valueId.toString()).sort().join(",");
    const newColorKeys = new Set(colorCombinations.map(colorKey));
    // Compared whole-combination, like generation does. A flat set of the selected
    // values would call "M / Round" already covered because some other row uses M.
    const newSizeSignatures = new Set(
      sizeCombinations.map((combo) => buildAttributeSignature(combo.map((v) => v.valueId)))
    );

    const existingVariants = await db.productVariant.findMany({
      where: { itemId: item.id, deleted_at: null },
      select: {
        id: true,
        uuid: true,
        color_name: true,
        variant_attribute_values: {
          select: { attribute_value_id: true, attribute_values: { select: { value: true } } },
        },
        variant_unit_prices: {
          where: { deleted_at: null },
          select: {
            id: true,
            uuid: true,
            sku: true,
            attribute_value_id: true,
            attribute_signature: true,
            attribute_value: { select: { value: true } },
          },
        },
      },
    });

    const existingColorKeys = new Set(
      colorCombinations.length > 0 || touchesColorAxis
        ? existingVariants.map((v) =>
            v.variant_attribute_values.map((x) => x.attribute_value_id.toString()).sort().join(",")
          )
        : []
    );

    const toAddColors = touchesColorAxis
      ? colorCombinations.filter((c) => !existingColorKeys.has(colorKey(c))).length
      : 0;

    const removeColors: PreviewGenerateVariantsResponse["toRemove"]["colors"] = [];
    const removeSizes: PreviewGenerateVariantsResponse["toRemove"]["sizes"] = [];
    let toAddSizes = 0;

    for (const variant of existingVariants) {
      const variantColorKey = variant.variant_attribute_values
        .map((x) => x.attribute_value_id.toString())
        .sort()
        .join(",");
      const colorIsDeselected = touchesColorAxis && !newColorKeys.has(variantColorKey);

      if (colorIsDeselected) {
        removeColors.push({
          variantUuid: variant.uuid,
          label:
            variant.variant_attribute_values.map((x) => x.attribute_values.value).join(" / ") ||
            variant.color_name ||
            "Default",
        });
        // A whole Color being removed also removes every Size row under it -
        // don't double-report those individually.
        continue;
      }

      for (const unitPrice of variant.variant_unit_prices) {
        // A row with no variation values of its own (a pack size, or a single
        // unnamed row) is not something the Size selection can supersede, so it is
        // left alone - same as before signatures existed.
        if (
          touchesSizeAxis &&
          unitPrice.attribute_signature !== "" &&
          !newSizeSignatures.has(unitPrice.attribute_signature)
        ) {
          removeSizes.push({
            variantUuid: variant.uuid,
            unitPriceUuid: unitPrice.uuid,
            label: unitPrice.attribute_value?.value ?? unitPrice.sku,
          });
        }
      }

      if (touchesSizeAxis) {
        const existingSignaturesForColor = new Set(
          variant.variant_unit_prices.map((up) => up.attribute_signature)
        );
        toAddSizes += [...newSizeSignatures].filter(
          (signature) => !existingSignaturesForColor.has(signature)
        ).length;
      }
    }

    return {
      toAdd: {
        colorCount: toAddColors,
        sizeCount: toAddSizes,
      },
      toRemove: {
        colors: removeColors,
        sizes: removeSizes,
      },
    };
  },

  /**
   * Applies a set of removals the admin explicitly confirmed after reviewing
   * previewGenerateVariants' toRemove list. Soft-deletes only (deleted_at +
   * isActive=false, same convention as every other delete in this feature) -
   * never a hard delete, since a variant/unit price can be referenced by past
   * orders. Scoped to the given Item so a stray UUID from another Item can't be
   * deactivated by mistake.
   */
  async applyVariantRemovals(
    itemUuid: string,
    input: ApplyVariantRemovalsInput,
    adminEmail?: string
  ): Promise<{ deactivatedVariants: number; deactivatedUnitPrices: number }> {
    const adminId = await getAdminInternalId(adminEmail);

    const item = await itemRepository.findByUuid(itemUuid);
    if (!item || item.deleted_at !== null) {
      throw ApiError.notFound("Item not found");
    }

    const variantUuids = input.variantUuids ?? [];
    const unitPriceUuids = input.unitPriceUuids ?? [];

    let deactivatedVariants = 0;
    let deactivatedUnitPrices = 0;

    await db.$transaction(async (tx) => {
      if (variantUuids.length > 0) {
        const result = await tx.productVariant.updateMany({
          where: { uuid: { in: variantUuids }, itemId: item.id, deleted_at: null },
          data: { isActive: false, deleted_at: new Date(), updated_by: adminId },
        });
        deactivatedVariants = result.count;
      }

      if (unitPriceUuids.length > 0) {
        const result = await tx.variantUnitPrice.updateMany({
          where: {
            uuid: { in: unitPriceUuids },
            deleted_at: null,
            variant: { itemId: item.id },
          },
          data: { isActive: false, deleted_at: new Date(), updated_by: adminId },
        });
        deactivatedUnitPrices = result.count;
      }
    });

    return { deactivatedVariants, deactivatedUnitPrices };
  },
};

function skuPart(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 20);
}

function buildVariantUpdateData(
  data: UpdateAdminVariantInput,
  adminId: bigint | null
): Prisma.ProductVariantUncheckedUpdateInput {
  const updateData: Prisma.ProductVariantUncheckedUpdateInput = {};

  if (adminId) {
    updateData.updated_by = adminId;
  }
  if (data.variantName !== undefined) {
    updateData.variant_name = data.variantName;
  }
  if (data.priceAdjustment !== undefined) {
    updateData.price_adjustment = data.priceAdjustment;
  }
  if (data.isFeatured !== undefined) {
    updateData.is_featured = data.isFeatured;
  }
  if (typeof data.isActive === "boolean") {
    updateData.isActive = data.isActive;
  }
  if (typeof data.outOfStock === "boolean") {
    updateData.out_of_stock = data.outOfStock;
  }

  return updateData;
}
