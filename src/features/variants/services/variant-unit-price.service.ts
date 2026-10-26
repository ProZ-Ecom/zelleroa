import crypto from "crypto";
import { setStockLevel } from "@/features/inventory/services/stock-ledger.service";
import { recordOpeningStockPurchase } from "@/features/purchases/services/opening-stock.service";
import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { variantRepository } from "../repositories/variant.repository";
import { variantUnitPriceRepository } from "../repositories/variant-unit-price.repository";
import { unitRepository } from "@/features/units/repositories/unit.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import { formatUnitPriceResponse } from "./variant.service";
import { buildAttributeSignature } from "../utils/attribute-signature.util";
import type { Prisma } from "@/generated/prisma";
import type {
  VariantUnitPriceResponse,
  VariantPriceHistoryResponse,
  GetVariantPriceHistoryParams,
  PriceHistoryChartItem,
  BulkEditVariantItem,
} from "../types";
import type {
  CreateVariantUnitPriceInput,
  UpdateVariantUnitPriceInput,
  BulkSetSamePriceInput,
} from "../validations/admin-variant-unit-price.schema";

function formatVariantPriceHistory(
  item: Prisma.variant_price_historyGetPayload<{
    include: {
      users_variant_price_history_created_byTousers: {
        select: {
          id: true;
          uuid: true;
          name: true;
        };
      };
    };
  }>
): VariantPriceHistoryResponse {
  const user = item.users_variant_price_history_created_byTousers;
  const oldPrice = item.old_base_price !== null ? Number(item.old_base_price) : null;
  const newPrice = item.new_base_price !== null ? Number(item.new_base_price) : null;

  return {
    id: item.uuid || String(item.id),
    variantUnitPriceId: String(item.variant_unit_price_id),
    oldPrice,
    newPrice,
    oldBasePrice: oldPrice,
    newBasePrice: newPrice,
    changedAt: item.changed_at,
    changedBy: user
      ? {
          id: user.uuid || String(user.id),
          name: user.name,
        }
      : null,
  };
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

function skuPart(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 20);
}

/**
 * Resolves the SKU-axis values a row should carry, in the order the product
 * configures its attributes - so the primary value (the one that stays on
 * `attribute_value_id` for labels) is the same pick the generator would make.
 */
async function resolveAttributeValues(
  variantId: bigint,
  valueUuids: string[]
): Promise<{ attributeId: bigint; attributeValueId: bigint; value: string }[]> {
  if (valueUuids.length === 0) return [];

  const values = await db.attributeValue.findMany({
    where: { uuid: { in: valueUuids }, is_active: true },
    select: { id: true, value: true, attributeId: true },
  });
  if (values.length !== new Set(valueUuids).size) {
    throw ApiError.badRequest("Invalid size attribute value");
  }
  if (new Set(values.map((v) => v.attributeId.toString())).size !== values.length) {
    throw ApiError.badRequest("Only one value per attribute can be selected for a stock row");
  }

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    select: { item: { select: { style: { select: { productId: true } } } } },
  });
  const configs = variant
    ? await db.product_attribute_configs.findMany({
        where: {
          product_id: variant.item.style.productId,
          attribute_id: { in: values.map((v) => v.attributeId) },
        },
        select: { attribute_id: true, sort_order: true },
      })
    : [];
  const sortOrderOf = new Map(
    configs.map((c) => [c.attribute_id.toString(), c.sort_order])
  );

  return values
    .map((v) => ({
      attributeId: v.attributeId,
      attributeValueId: v.id,
      value: v.value,
      sortOrder: sortOrderOf.get(v.attributeId.toString()) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.attributeValueId < b.attributeValueId ? -1 : 1))
    .map(({ attributeId, attributeValueId, value }) => ({ attributeId, attributeValueId, value }));
}

/**
 * Builds a SKU as {item code}-{Color}-{variation values}, skipping whichever parts
 * the variant doesn't have (e.g. no Size on a Watch). Falls back to appending a
 * numeric suffix if the generated code collides with an existing SKU.
 */
async function generateSku(
  variant: {
    item?: { slug?: string | null } | null;
    color_name?: string | null;
  },
  sizeValues: string[] = []
): Promise<string> {
  const parts: string[] = [];

  if (variant.item?.slug) {
    parts.push(skuPart(variant.item.slug));
  }

  if (variant.color_name) parts.push(skuPart(variant.color_name));
  for (const value of sizeValues) {
    if (value) parts.push(skuPart(value));
  }

  const base = parts.filter(Boolean).join("-") || `ITEM-${Date.now()}`;

  let candidate = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await variantUnitPriceRepository.findBySku(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

/**
 * A size row created without a price sells at its Item's price - the one
 * place a price is entered. Color/size "add-ons" are no longer part of it.
 */
function itemPriceOf(variant: {
  item?: { base_price?: Prisma.Decimal | number | null } | null;
}): number {
  return Number(variant.item?.base_price ?? 0);
}

export const variantUnitPriceService = {
  async listByVariantUuid(variantUuid: string): Promise<VariantUnitPriceResponse[]> {
    const variant = await variantRepository.findByUuid(variantUuid);
    if (!variant || variant.deleted_at !== null) {
      throw ApiError.notFound("Variant not found");
    }

    const items = await variantUnitPriceRepository.findAllByVariantId(variant.id);
    return items.map((item) => formatUnitPriceResponse(variantUuid, item));
  },

  async createUnitPrice(
    variantUuid: string,
    data: CreateVariantUnitPriceInput,
    adminEmail?: string
  ): Promise<VariantUnitPriceResponse> {
    const adminId = await getAdminInternalId(adminEmail);

    const variant = await variantRepository.findByUuid(variantUuid);
    if (!variant || variant.deleted_at !== null) {
      throw ApiError.notFound("Variant not found");
    }

    const unit = await unitRepository.findByUuid(data.unitId);
    if (!unit || !unit.is_active) {
      throw ApiError.badRequest("Invalid or inactive unit");
    }

    // Every SKU-axis value this row carries, in the product's attribute order.
    const attributeValues = await resolveAttributeValues(
      variant.id,
      data.attributeValueIds ?? (data.sizeValueId ? [data.sizeValueId] : [])
    );
    // The first axis stays on attribute_value_id, which labels and size charts read.
    const sizeValueInternalId = attributeValues[0]?.attributeValueId ?? null;

    const attributeSignature = buildAttributeSignature(
      attributeValues.map((v) => v.attributeValueId)
    );

    const duplicateSize = await variantUnitPriceRepository.findByVariantAndSignature(
      variant.id,
      unit.id,
      data.unitValue,
      attributeSignature
    );
    if (duplicateSize) {
      throw ApiError.conflict("This item/color already has a price for that size");
    }

    let sku = data.sku;
    if (sku) {
      const existingSku = await variantUnitPriceRepository.findBySku(sku);
      if (existingSku) {
        throw ApiError.conflict(`An active unit price with SKU '${sku}' already exists`);
      }
    } else {
      sku = await generateSku(
        variant,
        attributeValues.map((v) => v.value)
      );
    }

    const duplicateUnit = await variantUnitPriceRepository.findByVariantAndUnit(
      variant.id,
      unit.id,
      data.unitValue
    );
    // A row with no variation of its own is told apart by its unit and measurement,
    // so a second one of those really is a duplicate.
    if (duplicateUnit && attributeValues.length === 0) {
      throw ApiError.conflict("This item already has a price for that unit and measurement");
    }

    if (data.isDefault) {
      await variantUnitPriceRepository.unsetDefaultForVariant(variant.id);
    }

    let basePrice = data.basePrice;
    if (basePrice === undefined) {
      basePrice = itemPriceOf(variant);
      if (basePrice <= 0) {
        throw ApiError.badRequest(
          "Enter a price for this size, or set the Item's price first"
        );
      }
    }

    const row = {
      unit_id: unit.id,
      unit_value: data.unitValue,
      attribute_value_id: sizeValueInternalId,
      attribute_signature: attributeSignature,
      sku,
      base_price: basePrice,
      is_default: data.isDefault ?? false,
      isActive: data.isActive !== undefined ? data.isActive : true,
      updated_by: adminId,
    };

    // A previously deleted row still holds this combination in
    // uniq_vup_variant_signature, so reuse it rather than inserting a duplicate that
    // the database would reject.
    const archived = await variantUnitPriceRepository.findDeletedByVariantAndSignature(
      variant.id,
      unit.id,
      data.unitValue,
      attributeSignature
    );

    const created = archived
      ? await variantUnitPriceRepository.reviveById(archived.id, row, attributeValues)
      : await variantUnitPriceRepository.create(
          {
            uuid: crypto.randomUUID(),
            variant_id: variant.id,
            created_by: adminId,
            ...row,
          },
          attributeValues
        );

    // A revived row carries its pre-deletion inventory, which would silently
    // reappear as stock nobody re-counted, so it restarts at the requested
    // quantity (zero when the caller sent none).
    const stock = data.stock ?? (archived ? 0 : undefined);

    if (stock !== undefined) {
      await db.$transaction(async (tx) => {
        // Zero (or a revived row's stale level) is just a reset; real opening
        // stock goes through a purchase order so purchase data matches stock.
        if (stock === 0 || archived) {
          await setStockLevel(tx, {
            variantUnitPriceId: created.id,
            target: 0,
            reason: "Opening stock",
            actorId: adminId,
          });
        }
        await recordOpeningStockPurchase(
          tx,
          [{ variantUnitPriceId: created.id, quantity: stock }],
          adminId,
          `Opening stock for ${created.sku}`
        );
      });
    }

    const withDetails = await variantUnitPriceRepository.findByUuid(created.uuid);
    return formatUnitPriceResponse(variantUuid, withDetails || created);
  },

  async updateUnitPrice(
    variantUuid: string,
    unitPriceUuid: string,
    data: UpdateVariantUnitPriceInput,
    adminEmail?: string
  ): Promise<VariantUnitPriceResponse> {
    const variant = await variantRepository.findByUuid(variantUuid);
    if (!variant || variant.deleted_at !== null) {
      throw ApiError.notFound("Variant not found");
    }

    const existing = await variantUnitPriceRepository.findByUuid(unitPriceUuid);
    if (!existing || existing.variant_id !== variant.id) {
      throw ApiError.notFound("Unit price not found for this variant");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updateData: Prisma.VariantUnitPriceUncheckedUpdateInput & { stock?: number } = {};

    if (adminId) {
      updateData.updated_by = adminId;
    }

    let effectiveUnitId = existing.unit_id;
    if (data.unitId !== undefined) {
      const unit = await unitRepository.findByUuid(data.unitId);
      if (!unit || !unit.is_active) {
        throw ApiError.badRequest("Invalid or inactive unit");
      }
      effectiveUnitId = unit.id;
      updateData.unit_id = unit.id;
    }

    const effectiveUnitValue =
      data.unitValue !== undefined ? data.unitValue : existing.unit_value;

    if (data.unitId !== undefined || data.unitValue !== undefined) {
      const duplicateUnit = await variantUnitPriceRepository.findByVariantAndUnit(
        variant.id,
        effectiveUnitId,
        effectiveUnitValue,
        unitPriceUuid
      );
      if (duplicateUnit) {
        throw ApiError.conflict("This item already has a price for that unit and measurement");
      }
    }

    if (data.unitValue !== undefined) {
      updateData.unit_value = data.unitValue;
    }

    if (data.attributeValueIds !== undefined || data.sizeValueId !== undefined) {
      const attributeValues = await resolveAttributeValues(
        variant.id,
        data.attributeValueIds ?? (data.sizeValueId ? [data.sizeValueId] : [])
      );
      const sizeValueInternalId = attributeValues[0]?.attributeValueId ?? null;
      const attributeSignature = buildAttributeSignature(
        attributeValues.map((v) => v.attributeValueId)
      );
      const duplicateSize = await variantUnitPriceRepository.findByVariantAndSignature(
        variant.id,
        effectiveUnitId,
        Number(effectiveUnitValue),
        attributeSignature,
        unitPriceUuid
      );
      if (duplicateSize) {
        throw ApiError.conflict("This item/color already has a price for that size");
      }
      updateData.attribute_value_id = sizeValueInternalId;
      updateData.attribute_signature = attributeSignature;
      // Changing the row's variation has to replace its join rows, or the old value
      // would keep claiming this row in a shopper's selection.
      await variantUnitPriceRepository.replaceAttributeValues(existing.id, attributeValues);
    }

    if (data.sku !== undefined && data.sku !== existing.sku) {
      const skuConflict = await variantUnitPriceRepository.findBySku(data.sku, unitPriceUuid);
      if (skuConflict) {
        throw ApiError.conflict(`An active unit price with SKU '${data.sku}' already exists`);
      }
      updateData.sku = data.sku;
    }

    if (data.basePrice !== undefined) {
      updateData.base_price = data.basePrice;
    }

    if (typeof data.isDefault === "boolean") {
      updateData.is_default = data.isDefault;
    }

    if (typeof data.isActive === "boolean") {
      updateData.isActive = data.isActive;
    }

    if (data.stock !== undefined) {
      updateData.stock = data.stock;
    }

    const updated = await variantUnitPriceRepository.updateByUuid(
      unitPriceUuid,
      updateData,
      adminId
    );
    if (!updated) {
      throw ApiError.notFound("Unit price not found");
    }

    return formatUnitPriceResponse(variantUuid, updated);
  },

  async deleteUnitPrice(
    variantUuid: string,
    unitPriceUuid: string,
    adminEmail?: string
  ) {
    const variant = await variantRepository.findByUuid(variantUuid);
    if (!variant || variant.deleted_at !== null) {
      throw ApiError.notFound("Variant not found");
    }

    const existing = await variantUnitPriceRepository.findByUuid(unitPriceUuid);
    if (!existing || existing.variant_id !== variant.id) {
      throw ApiError.notFound("Unit price not found for this variant");
    }

    const adminId = await getAdminInternalId(adminEmail);
    await variantUnitPriceRepository.softDeleteByUuid(unitPriceUuid, adminId);

    return { success: true, message: "Unit price deleted successfully" };
  },

  /**
   * "Same price for all sizes" - sets base_price uniformly across every unit
   * price row under a variant, then applies any per-row overrides in the same
   * request (spec: admin enters one price, can still tweak individual sizes).
   */
  async bulkSetSamePriceForVariant(
    variantUuid: string,
    data: BulkSetSamePriceInput,
    adminEmail?: string
  ): Promise<VariantUnitPriceResponse[]> {
    const adminId = await getAdminInternalId(adminEmail);

    const variant = await variantRepository.findByUuid(variantUuid);
    if (!variant || variant.deleted_at !== null) {
      throw ApiError.notFound("Variant not found");
    }

    const updated = await variantUnitPriceRepository.bulkSetSamePrice(
      variant.id,
      data.basePrice,
      data.perSizeOverrides,
      adminId
    );

    return updated.map((item) => formatUnitPriceResponse(variantUuid, item));
  },

  async bulkUpdateUnitPrices(
    body: { variants: BulkEditVariantItem[] },
    adminEmail?: string
  ): Promise<VariantUnitPriceResponse[]> {
    const adminId = await getAdminInternalId(adminEmail);

    try {
      const updated = await variantUnitPriceRepository.bulkUpdateUnitPrices(
        body.variants,
        adminId
      );

      return updated.map((item) =>
        formatUnitPriceResponse(item.variant?.uuid || "", item)
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("not found")) {
        throw ApiError.notFound(message);
      }
      throw e;
    }
  },

  async getPriceHistory(
    unitPriceUuid: string,
    params: GetVariantPriceHistoryParams = {}
  ) {
    const unitPrice = await variantUnitPriceRepository.findByUuid(unitPriceUuid);
    if (!unitPrice || unitPrice.deleted_at !== null) {
      throw ApiError.notFound("Variant unit price not found");
    }

    const result = await variantUnitPriceRepository.findPriceHistoryByUnitPriceId(
      unitPrice.id,
      params
    );

    return {
      data: result.data.map(formatVariantPriceHistory),
      meta: result.meta,
    };
  },

  async getPriceHistoryChart(
    unitPriceUuid: string,
    period: string = "1y"
  ): Promise<PriceHistoryChartItem[]> {
    const unitPrice = await variantUnitPriceRepository.findByUuid(unitPriceUuid);
    if (!unitPrice || unitPrice.deleted_at !== null) {
      throw ApiError.notFound("Variant unit price not found");
    }

    const currentBasePrice = Number(unitPrice.base_price);

    const histories = await variantUnitPriceRepository.findPriceHistoryAllByUnitPriceId(
      unitPrice.id
    );

    let monthsCount = 12;
    if (period === "1m") monthsCount = 1;
    else if (period === "3m") monthsCount = 3;
    else if (period === "6m") monthsCount = 6;
    else if (period === "1y") monthsCount = 12;

    const now = new Date();
    const monthsList: string[] = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      monthsList.push(`${year}-${month}`);
    }

    const chartData: PriceHistoryChartItem[] = [];

    for (const monthStr of monthsList) {
      const [yearStr, monthNumStr] = monthStr.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthNumStr, 10);
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      const historiesUpToMonth = histories.filter(
        (h) => new Date(h.changed_at) <= endOfMonth
      );

      let price = currentBasePrice;

      if (historiesUpToMonth.length > 0) {
        const latestRecord = historiesUpToMonth[historiesUpToMonth.length - 1];
        price =
          latestRecord.new_base_price !== null
            ? Number(latestRecord.new_base_price)
            : currentBasePrice;
      } else if (histories.length > 0) {
        const earliestRecord = histories[0];
        price =
          earliestRecord.old_base_price !== null
            ? Number(earliestRecord.old_base_price)
            : currentBasePrice;
      }

      chartData.push({ month: monthStr, price });
    }

    return chartData;
  },
};
