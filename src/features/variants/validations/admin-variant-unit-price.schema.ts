import { z } from "zod";

export const createVariantUnitPriceSchema = z
  .object({
    unitId: z
      .string({ message: "Unit ID is required" })
      .uuid("Invalid Unit UUID format"),
    unitValue: z
      .number({ message: "Unit value is required" })
      .gt(0, "Unit value must be greater than 0"),
    /** The Size attribute value (e.g. "M") this price row represents, if any.
     * Superseded by `attributeValueIds`, which can carry several axes; kept so a
     * single-axis caller does not have to change. */
    sizeValueId: z.string().trim().uuid("Invalid attribute value UUID format").optional().nullable(),
    /** Every SKU-axis value this row represents (e.g. Size=M AND Neck=V). One value
     * per attribute; wins over `sizeValueId` when both are sent. */
    attributeValueIds: z
      .array(z.string().trim().uuid("Invalid attribute value UUID format"))
      .optional(),
    /** Auto-generated from the item code + the variant's Size/Color when omitted. */
    sku: z
      .string()
      .trim()
      .min(1, "SKU cannot be empty")
      .max(100, "SKU cannot exceed 100 characters")
      .optional(),
    /** Left blank, this is auto-calculated from product base price + color/size add-ons. */
    basePrice: z
      .number()
      .min(0, "Base price cannot be negative")
      .optional(),
    isDefault: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export type CreateVariantUnitPriceInput = z.infer<typeof createVariantUnitPriceSchema>;

export const updateVariantUnitPriceSchema = z
  .object({
    unitId: z.string().uuid("Invalid Unit UUID format").optional(),
    unitValue: z.number().gt(0, "Unit value must be greater than 0").optional(),
    sizeValueId: z.string().trim().uuid("Invalid attribute value UUID format").optional().nullable(),
    /** Replaces the row's whole variation. Wins over `sizeValueId` when both are sent. */
    attributeValueIds: z
      .array(z.string().trim().uuid("Invalid attribute value UUID format"))
      .optional(),
    sku: z
      .string()
      .trim()
      .min(1, "SKU cannot be empty")
      .max(100, "SKU cannot exceed 100 characters")
      .optional(),
    basePrice: z.number().min(0, "Base price cannot be negative").optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdateVariantUnitPriceInput = z.infer<typeof updateVariantUnitPriceSchema>;

export const bulkEditUnitPriceItemSchema = z
  .object({
    id: z
      .string({ message: "Variant unit price id is required" })
      .trim()
      .uuid("Invalid Variant Unit Price UUID format"),
    price: z.number().min(0, "Price cannot be negative").optional(),
    basePrice: z.number().min(0, "Base price cannot be negative").optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const bulkEditUnitPricesSchema = z
  .object({
    unitPrices: z
      .array(bulkEditUnitPriceItemSchema)
      .min(1, "At least one unit price must be provided for bulk edit"),
  })
  .strict();

export type BulkEditUnitPriceItemInput = z.infer<typeof bulkEditUnitPriceItemSchema>;
export type BulkEditUnitPricesInput = z.infer<typeof bulkEditUnitPricesSchema>;

/**
 * "Same price for all sizes": basePrice is applied to every unit price row
 * under the variant, then any per-row entries in perSizeOverrides win.
 */
export const bulkSetSamePriceSchema = z
  .object({
    basePrice: z.number().min(0, "Base price cannot be negative"),
    perSizeOverrides: z
      .array(
        z.object({
          id: z.string().trim().uuid("Invalid Variant Unit Price UUID format"),
          basePrice: z.number().min(0, "Base price cannot be negative").optional(),
          sku: z.string().trim().min(1).max(100).optional(),
        })
      )
      .optional()
      .default([]),
  })
  .strict();

export type BulkSetSamePriceInput = z.infer<typeof bulkSetSamePriceSchema>;
