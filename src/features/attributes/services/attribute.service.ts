import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { attributeRepository } from "../repositories/attribute.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import { productRepository } from "@/features/products/repositories/product.repository";
import { itemRepository } from "@/features/items/repositories/item.repository";
import { db } from "@/lib/db/prisma";
import type {
  AttributeListItem,
  GetAdminAttributesParams,
  ProductAttributeUsage,
  VariationLevel,
} from "../types";
import type {
  CreateAdminAttributeInput,
  UpdateAdminAttributeInput,
} from "../validations/admin-attribute.schema";

type AttributeWithRelations = {
  id: bigint;
  uuid: string | null;
  name: string;
  slug: string;
  type: string;
  multiple_selection: boolean;
  is_active: boolean;
  createdAt: Date;
  values: {
    id: bigint;
    uuid: string | null;
    value: string;
    color_hex: string | null;
    image_url: string | null;
    is_active: boolean;
    createdAt: Date;
    price_adjustment: unknown;
  }[];
};

function formatAttribute(attribute: AttributeWithRelations): AttributeListItem {
  const attributeUuid = attribute.uuid || String(attribute.id);
  return {
    id: attributeUuid,
    name: attribute.name,
    slug: attribute.slug,
    type: (attribute.type as "text" | "color") ?? "text",
    multipleSelection: Boolean(attribute.multiple_selection),
    isActive: Boolean(attribute.is_active),
    createdAt: attribute.createdAt,
    values: attribute.values.map((v) => ({
      id: v.uuid || String(v.id),
      value: v.value,
      colorHex: v.color_hex,
      imageUrl: v.image_url,
      isActive: Boolean(v.is_active),
      createdAt: v.createdAt,
      priceAdjustment: Number(v.price_adjustment ?? 0),
    })),
    _count: { values: attribute.values.length },
  };
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

export const attributeService = {
  async createAdminAttribute(
    data: CreateAdminAttributeInput,
    adminEmail?: string
  ): Promise<AttributeListItem> {
    const adminId = await getAdminInternalId(adminEmail);

    const existingSlug = await attributeRepository.findBySlug(data.slug);
    if (existingSlug) {
      throw ApiError.conflict(`An attribute with code '${data.slug}' already exists`);
    }

    const existingName = await attributeRepository.findByName(data.name);
    if (existingName) {
      throw ApiError.conflict(`An attribute with name '${data.name}' already exists`);
    }

    const created = await attributeRepository.create({
      uuid: crypto.randomUUID(),
      name: data.name,
      slug: data.slug,
      type: data.type ?? "text",
      multiple_selection: data.multipleSelection ?? true,
      is_active: true,
      created_by: adminId,
      updated_by: adminId,
    });

    const attributeType = data.type ?? "text";
    await Promise.all(
      data.values.map((v) =>
        attributeRepository.createValue(
          created.id,
          v.value,
          adminId,
          undefined,
          attributeType === "color" ? v.colorHex ?? null : undefined,
          attributeType === "color" ? v.imageUrl ?? null : undefined
        )
      )
    );

    const withRelations = await attributeRepository.findByUuid(created.uuid!);
    return formatAttribute(withRelations as AttributeWithRelations);
  },

  async getAdminAttributes(params: GetAdminAttributesParams = {}) {
    const result = await attributeRepository.findAdminAll(params);
    return {
      data: result.data.map((a) => formatAttribute(a as AttributeWithRelations)),
      meta: result.meta,
    };
  },

  async getAdminAttributeByUuid(uuid: string): Promise<AttributeListItem> {
    const attribute = await attributeRepository.findByUuid(uuid);
    if (!attribute) {
      throw ApiError.notFound("Attribute not found");
    }
    return formatAttribute(attribute as AttributeWithRelations);
  },

  async updateAdminAttribute(
    uuid: string,
    data: UpdateAdminAttributeInput,
    adminEmail?: string
  ): Promise<AttributeListItem> {
    const existing = await attributeRepository.findByUuid(uuid);
    if (!existing) {
      throw ApiError.notFound("Attribute not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updateData: Record<string, unknown> = {};
    if (adminId) updateData.updated_by = adminId;

    if (data.slug !== undefined && data.slug !== existing.slug) {
      const slugConflict = await attributeRepository.findBySlug(data.slug, uuid);
      if (slugConflict) {
        throw ApiError.conflict(`An attribute with code '${data.slug}' already exists`);
      }
      updateData.slug = data.slug;
    }

    if (data.name !== undefined && data.name !== existing.name) {
      const nameConflict = await attributeRepository.findByName(data.name, uuid);
      if (nameConflict) {
        throw ApiError.conflict(`An attribute with name '${data.name}' already exists`);
      }
      updateData.name = data.name;
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    if (data.multipleSelection !== undefined) {
      updateData.multiple_selection = data.multipleSelection;
    }

    const updated = await attributeRepository.updateByUuid(uuid, updateData);
    if (!updated) {
      throw ApiError.notFound("Attribute not found");
    }

    return formatAttribute(updated as AttributeWithRelations);
  },

  async deleteAdminAttribute(uuid: string, adminEmail?: string) {
    const existing = await attributeRepository.findByUuid(uuid);
    if (!existing) {
      throw ApiError.notFound("Attribute not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    await attributeRepository.softDeleteByUuid(uuid, adminId);

    return { success: true, message: "Attribute deleted successfully" };
  },

  async addValue(
    attributeUuid: string,
    value: string,
    adminEmail?: string,
    priceAdjustment?: number,
    colorHex?: string,
    imageUrl?: string
  ) {
    const attribute = await attributeRepository.findByUuid(attributeUuid);
    if (!attribute) {
      throw ApiError.notFound("Attribute not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const duplicate = attribute.values.find(
      (v) => v.value.toLowerCase() === value.toLowerCase()
    );
    if (duplicate) {
      throw ApiError.conflict(`Value '${value}' already exists for this attribute`);
    }

    if ((attribute as AttributeWithRelations).type === "color" && !colorHex) {
      throw ApiError.badRequest("Color code is required for a Color attribute value");
    }

    await attributeRepository.createValue(
      attribute.id,
      value,
      adminId,
      priceAdjustment,
      colorHex ?? null,
      imageUrl ?? null
    );
    const refreshed = await attributeRepository.findByUuid(attributeUuid);
    return formatAttribute(refreshed as AttributeWithRelations);
  },

  async updateValue(
    attributeUuid: string,
    valueUuid: string,
    value: string | undefined,
    adminEmail?: string,
    priceAdjustment?: number,
    colorHex?: string,
    imageUrl?: string
  ) {
    const attribute = await attributeRepository.findByUuid(attributeUuid);
    if (!attribute) {
      throw ApiError.notFound("Attribute not found");
    }

    if ((attribute as AttributeWithRelations).type === "color" && colorHex === "") {
      throw ApiError.badRequest("Color code is required for a Color attribute value");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updated = await attributeRepository.updateValueByUuid(
      valueUuid,
      value,
      adminId,
      priceAdjustment,
      colorHex !== undefined ? colorHex : undefined,
      imageUrl !== undefined ? imageUrl : undefined
    );
    if (!updated) {
      throw ApiError.notFound("Attribute value not found");
    }

    const refreshed = await attributeRepository.findByUuid(attributeUuid);
    return formatAttribute(refreshed as AttributeWithRelations);
  },

  async deleteValue(attributeUuid: string, valueUuid: string, adminEmail?: string) {
    const adminId = await getAdminInternalId(adminEmail);
    const deleted = await attributeRepository.softDeleteValueByUuid(valueUuid, adminId);
    if (!deleted) {
      throw ApiError.notFound("Attribute value not found");
    }

    const refreshed = await attributeRepository.findByUuid(attributeUuid);
    if (!refreshed) {
      throw ApiError.notFound("Attribute not found");
    }
    return formatAttribute(refreshed as AttributeWithRelations);
  },

  /**
   * The Product's configured attributes WITH their values (e.g. Color: Black,
   * White) - powers the single-variant "Add/Edit Item" form and the bulk
   * "Generate Variants" form, so attribute selection is driven purely by what
   * the Product has configured (no category involved).
   */
  async getConfiguredAttributesForProduct(productUuid: string) {
    const product = await productRepository.findByUuid(productUuid);
    if (!product) return [];

    const configs = await attributeRepository.findAttributeConfigsForProduct(product.id);
    return configs.map((config) => ({
      id: config.product_attributes.uuid || String(config.product_attributes.id),
      name: config.product_attributes.name,
      slug: config.product_attributes.slug,
      type: (config.product_attributes.type as "text" | "color") ?? "text",
      isRequired: config.is_required,
      multipleSelection: Boolean(config.product_attributes.multiple_selection),
      variationLevel: config.variation_level as VariationLevel,
      sortOrder: config.sort_order,
      values: config.product_attributes.values.map((v) => ({
        id: v.uuid || String(v.id),
        value: v.value,
        colorHex: v.color_hex,
        imageUrl: v.image_url,
        isActive: Boolean(v.is_active),
        createdAt: v.createdAt,
        priceAdjustment: Number(v.price_adjustment ?? 0),
      })),
    }));
  },

  /**
   * All active attributes, flagged with whether they're currently configured
   * on this Product - powers the Product edit "Attributes" checkbox panel.
   */
  async getAttributesForProduct(productUuid: string) {
    const product = await productRepository.findByUuid(productUuid);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }

    const [allAttributes, configs] = await Promise.all([
      attributeRepository.findAllActive(),
      attributeRepository.findAttributeConfigsForProduct(product.id),
    ]);

    const configByAttributeId = new Map(configs.map((c) => [c.attribute_id.toString(), c]));

    return allAttributes.map((attribute) => {
      const config = configByAttributeId.get(attribute.id.toString());
      return {
        id: attribute.uuid || String(attribute.id),
        name: attribute.name,
        slug: attribute.slug,
        type: (attribute.type as "text" | "color") ?? "text",
        multipleSelection: Boolean(attribute.multiple_selection),
        configured: Boolean(config),
        isRequired: config?.is_required ?? false,
        sortOrder: config?.sort_order ?? 0,
        variationLevel: (config?.variation_level ?? "SKU") as VariationLevel,
      };
    });
  },

  /**
   * Full-replace the set of attributes configured on a Product, each with the level
   * it varies at. Two changes can strand existing data and so need `force: true`:
   * unchecking an attribute Items/Variants already use, and moving one off the SKU
   * axis while stock rows still identify themselves by it. Either way this throws
   * with the counts, so the admin UI can confirm instead of silently dropping data.
   */
  async setAttributesForProduct(
    productUuid: string,
    entries: { attributeId: string; variationLevel: VariationLevel }[],
    force: boolean,
    _adminEmail?: string
  ) {
    const product = await productRepository.findByUuid(productUuid);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }

    const resolved = await Promise.all(
      entries.map(async (entry) => {
        const attribute = await attributeRepository.findByUuid(entry.attributeId);
        if (!attribute) {
          throw ApiError.badRequest(`Attribute not found: ${entry.attributeId}`);
        }
        return { attribute, variationLevel: entry.variationLevel };
      })
    );

    const duplicates = resolved.length - new Set(resolved.map((r) => r.attribute.id.toString())).size;
    if (duplicates > 0) {
      throw ApiError.badRequest("Each attribute can only be configured once per product");
    }

    const nextLevelByAttributeId = new Map(
      resolved.map((r) => [r.attribute.id.toString(), r.variationLevel])
    );

    const existingConfigs = await attributeRepository.findAttributeConfigsForProduct(product.id);

    // Both of these leave data behind that no longer matches the configuration.
    const atRisk = existingConfigs
      .map((config) => {
        const nextLevel = nextLevelByAttributeId.get(config.attribute_id.toString());
        if (nextLevel === undefined) return { config, change: "removed" as const };
        if (config.variation_level === "SKU" && nextLevel !== "SKU") {
          return { config, change: "demoted" as const };
        }
        return null;
      })
      .filter((entry): entry is { config: (typeof existingConfigs)[number]; change: "removed" | "demoted" } =>
        entry !== null
      );

    if (atRisk.length && !force) {
      const usage: ProductAttributeUsage[] = await Promise.all(
        atRisk.map(async ({ config, change }) => {
          const counts = await attributeRepository.countProductAttributeUsage(
            product.id,
            config.attribute_id
          );
          return {
            attributeId: config.product_attributes.uuid || String(config.attribute_id),
            attributeName: config.product_attributes.name,
            itemCount: counts.itemCount,
            variantCount: counts.variantCount,
            skuCount: counts.skuCount,
            change,
          };
        })
      );
      const inUse = usage.filter(
        (u) => u.itemCount > 0 || u.variantCount > 0 || u.skuCount > 0
      );
      if (inUse.length) {
        throw ApiError.conflict(
          "Some attributes being changed are already used by items, variants or stock rows",
          { usage: inUse }
        );
      }
    }

    await attributeRepository.setAttributesForProduct(
      product.id,
      resolved.map((r, idx) => ({
        attributeId: r.attribute.id,
        isRequired: false,
        sortOrder: idx,
        variationLevel: r.variationLevel,
      }))
    );

    return attributeService.getAttributesForProduct(productUuid);
  },

  /**
   * The Item's currently selected attribute values, grouped by the Product's
   * configured attributes - only attributes configured on the parent Product
   * are ever offered, enforced here server-side (not just in the UI).
   */
  async getAttributeValuesForItem(itemUuid: string, productUuid?: string) {
    const item = await itemRepository.findByUuid(itemUuid);
    if (!item) {
      throw ApiError.notFound("Item not found");
    }

    const productId = item.style.productId;
    if (productUuid && item.style.product?.uuid !== productUuid) {
      throw ApiError.notFound("Item not found for this product");
    }
    const [configs, selected] = await Promise.all([
      attributeRepository.findAttributeConfigsForProduct(productId),
      attributeRepository.findAttributeValuesForItem(item.id),
    ]);

    const selectedValueIdsByAttribute = new Map<string, Set<string>>();
    for (const s of selected) {
      const key = s.attribute_id.toString();
      if (!selectedValueIdsByAttribute.has(key)) selectedValueIdsByAttribute.set(key, new Set());
      selectedValueIdsByAttribute.get(key)!.add(s.attribute_value_id.toString());
    }

    return configs.map((config) => {
      const attribute = config.product_attributes;
      const selectedIds = selectedValueIdsByAttribute.get(attribute.id.toString()) ?? new Set();
      return {
        id: attribute.uuid || String(attribute.id),
        name: attribute.name,
        slug: attribute.slug,
        type: (attribute.type as "text" | "color") ?? "text",
        isRequired: config.is_required,
        multipleSelection: Boolean(attribute.multiple_selection),
        values: attribute.values.map((v) => ({
          id: v.uuid || String(v.id),
          value: v.value,
          colorHex: v.color_hex,
          imageUrl: v.image_url,
          selected: selectedIds.has(v.id.toString()),
        })),
      };
    });
  },

  /**
   * Full-replace the Item's selected attribute values. Only values belonging
   * to attributes configured on the parent Product are accepted.
   */
  async setAttributeValuesForItem(
    itemUuid: string,
    attributeValueIds: string[],
    productUuid?: string
  ) {
    const item = await itemRepository.findByUuid(itemUuid);
    if (!item) {
      throw ApiError.notFound("Item not found");
    }

    const productId = item.style.productId;
    if (productUuid && item.style.product?.uuid !== productUuid) {
      throw ApiError.notFound("Item not found for this product");
    }
    const configs = await attributeRepository.findAttributeConfigsForProduct(productId);
    const allowedValueMap = new Map<string, { attributeId: bigint }>();
    const multipleSelectionByAttribute = new Map<string, boolean>();
    for (const config of configs) {
      multipleSelectionByAttribute.set(
        config.attribute_id.toString(),
        Boolean(config.product_attributes.multiple_selection)
      );
      for (const v of config.product_attributes.values) {
        allowedValueMap.set(v.uuid || String(v.id), { attributeId: config.attribute_id });
        allowedValueMap.set(String(v.id), { attributeId: config.attribute_id });
      }
    }

    const entries = attributeValueIds.map((valueUuid) => {
      const allowed = allowedValueMap.get(valueUuid);
      if (!allowed) {
        throw ApiError.badRequest(
          `Attribute value is not part of this product's configured attributes: ${valueUuid}`
        );
      }
      return { attributeId: allowed.attributeId, valueUuid };
    });

    // Single-selection attributes (Multiple Selection = OFF in the Attribute
    // Master) may only ever hold one value per Item - enforce it server-side,
    // not just in the UI.
    const countByAttributeId = new Map<string, number>();
    for (const entry of entries) {
      const key = entry.attributeId.toString();
      countByAttributeId.set(key, (countByAttributeId.get(key) ?? 0) + 1);
    }
    for (const [attributeId, count] of countByAttributeId) {
      if (count > 1 && multipleSelectionByAttribute.get(attributeId) === false) {
        throw ApiError.badRequest(
          `Only one value can be selected for a single-selection attribute`
        );
      }
    }

    const values = await db.attributeValue.findMany({
      where: { uuid: { in: entries.map((e) => e.valueUuid) } },
      select: { id: true, uuid: true },
    });
    const internalIdByUuid = new Map(values.map((v) => [v.uuid, v.id]));

    await attributeRepository.setAttributeValuesForItem(
      item.id,
      entries.map((e) => ({
        attributeId: e.attributeId,
        attributeValueId: internalIdByUuid.get(e.valueUuid) ?? BigInt(e.valueUuid),
      }))
    );

    return attributeService.getAttributeValuesForItem(itemUuid, productUuid);
  },
};
