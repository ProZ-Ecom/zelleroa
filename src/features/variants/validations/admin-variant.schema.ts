import { z } from "zod";
import { vegTypeEnum } from "@/features/products/validations/admin-product.schema";

export { vegTypeEnum };

export const createAdminVariantSchema = z
  .object({
    variantName: z
      .string()
      .trim()
      .max(100, "Variant name cannot exceed 100 characters")
      .optional(),
    slug: z
      .string({ message: "Slug is required" })
      .trim()
      .min(1, "Slug cannot be empty")
      .max(255, "Slug cannot exceed 255 characters"),
    /** Amount added to the product base price whenever this color is picked. */
    priceAdjustment: z.coerce.number().optional().default(0),
    isFeatured: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(false),
    outOfStock: z.boolean().optional().default(false),
    /** Attribute value UUIDs (e.g. Color=Red, Size=M) identifying this exact variant. */
    attributeValueIds: z
      .array(z.string().trim().uuid("Invalid attribute value UUID format"))
      .optional(),
  })
  .strict();

export type CreateAdminVariantInput = z.infer<typeof createAdminVariantSchema>;

export const updateAdminVariantSchema = z
  .object({
    variantName: z
      .string()
      .trim()
      .min(1, "Variant name cannot be empty")
      .max(100, "Variant name cannot exceed 100 characters")
      .optional(),
    slug: z
      .string()
      .trim()
      .min(1, "Slug cannot be empty")
      .max(255, "Slug cannot exceed 255 characters")
      .optional(),
    /** Amount added to the product base price whenever this color is picked. */
    priceAdjustment: z.coerce.number().optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    outOfStock: z.boolean().optional(),
    /** Attribute value UUIDs (e.g. Color=Red, Size=M) identifying this exact variant. */
    attributeValueIds: z
      .array(z.string().trim().uuid("Invalid attribute value UUID format"))
      .optional(),
  })
  .strict();

export type UpdateAdminVariantInput = z.infer<typeof updateAdminVariantSchema>;

export const bulkEditVariantItemSchema = z
  .object({
    id: z
      .string({ message: "Variant unit price id is required" })
      .trim()
      .uuid("Invalid Variant Unit Price UUID format"),
    price: z
      .number()
      .min(0, "Price cannot be negative")
      .optional(),
    basePrice: z
      .number()
      .min(0, "Base price cannot be negative")
      .optional(),
    stock: z
      .number()
      .int("Stock must be an integer")
      .min(0, "Stock cannot be negative")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const bulkEditVariantsSchema = z
  .object({
    variants: z
      .array(bulkEditVariantItemSchema)
      .min(1, "At least one variant must be provided for bulk edit"),
  })
  .strict();

export type BulkEditVariantItemInput = z.infer<typeof bulkEditVariantItemSchema>;
export type BulkEditVariantsInput = z.infer<typeof bulkEditVariantsSchema>;

/**
 * One variation option (e.g. "Color") plus the specific values to generate
 * combinations from (e.g. Black, White) - not necessarily every value the
 * attribute has, since an admin may only be stocking some of them.
 */
export const generateVariantOptionSchema = z
  .object({
    attributeId: z.string().trim().uuid("Invalid attribute UUID format"),
    valueIds: z
      .array(z.string().trim().uuid("Invalid attribute value UUID format"))
      .min(1, "Select at least one value for each variation option"),
  })
  .strict();

export const generateVariantsSchema = z
  .object({
    options: z
      .array(generateVariantOptionSchema)
      .min(1, "Select at least one variation option (e.g. Color, Size)"),
    unitId: z.string().trim().uuid("Invalid unit UUID format"),
    /** Applied to every generated combination unless overridden per-row afterwards. */
    defaultPrice: z.coerce.number().min(0, "Price cannot be negative").optional(),
    defaultStock: z.coerce
      .number()
      .int("Stock must be an integer")
      .min(0, "Stock cannot be negative")
      .optional()
      .default(0),
    activate: z.boolean().optional().default(true),
  })
  .strict()
  .refine(
    (data) => {
      const ids = data.options.map((o) => o.attributeId);
      return new Set(ids).size === ids.length;
    },
    { message: "Each variation option can only be added once", path: ["options"] }
  );

export type GenerateVariantOptionInput = z.infer<typeof generateVariantOptionSchema>;
export type GenerateVariantsInput = z.infer<typeof generateVariantsSchema>;
/** Client payload shape: fields with schema defaults (stock, activate) may be omitted. */
export type GenerateVariantsRequest = z.input<typeof generateVariantsSchema>;

/** Same option shape as generateVariantsSchema, without the row-level defaults -
 * a preview only needs to know which attribute values are selected. */
export const previewGenerateVariantsSchema = z
  .object({
    options: z
      .array(generateVariantOptionSchema)
      .min(1, "Select at least one variation option (e.g. Color, Size)"),
  })
  .strict()
  .refine(
    (data) => {
      const ids = data.options.map((o) => o.attributeId);
      return new Set(ids).size === ids.length;
    },
    { message: "Each variation option can only be added once", path: ["options"] }
  );

export type PreviewGenerateVariantsInput = z.infer<typeof previewGenerateVariantsSchema>;

/** Item-driven generation: attribute values come from item_attribute_values,
 * so only the pricing/unit defaults need to be supplied here. */
export const generateVariantsFromItemSchema = z
  .object({
    unitId: z.string().trim().uuid("Invalid unit UUID format"),
    defaultPrice: z.coerce.number().min(0, "Price cannot be negative").optional(),
    defaultStock: z.coerce
      .number()
      .int("Stock must be an integer")
      .min(0, "Stock cannot be negative")
      .optional()
      .default(0),
    activate: z.boolean().optional().default(true),
  })
  .strict();

export type GenerateVariantsFromItemInput = z.infer<typeof generateVariantsFromItemSchema>;

export const applyVariantRemovalsSchema = z
  .object({
    variantUuids: z.array(z.string().trim().uuid("Invalid variant UUID format")).optional(),
    unitPriceUuids: z
      .array(z.string().trim().uuid("Invalid unit price UUID format"))
      .optional(),
  })
  .strict()
  .refine(
    (data) => (data.variantUuids?.length ?? 0) + (data.unitPriceUuids?.length ?? 0) > 0,
    { message: "Select at least one variant or unit price to remove" }
  );

export type ApplyVariantRemovalsInput = z.infer<typeof applyVariantRemovalsSchema>;

export const priceHistoryChartQuerySchema = z.object({
  period: z.enum(["1m", "3m", "6m", "1y", "all"]).default("1y").optional(),
});

export type PriceHistoryChartQueryInput = z.infer<
  typeof priceHistoryChartQuerySchema
>;

export const adminVariantsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10).optional(),
  search: z.string().trim().optional(),
  itemId: z.string().trim().uuid("Invalid Item UUID format").optional(),
  itemUuid: z.string().trim().uuid("Invalid Item UUID format").optional(),
  isActive: z.coerce.boolean().optional(),
});

export type AdminVariantsQueryInput = z.infer<typeof adminVariantsQuerySchema>;

export const adminVariantListSchema = z
  .object({
    page: z.number().int().min(1, "page must be at least 1").default(1),
    pageSize: z
      .number()
      .int()
      .min(1, "pageSize must be at least 1")
      .max(100, "pageSize cannot exceed 100")
      .default(20),
    limit: z.number().int().min(1).max(100).optional(),
    search: z.string().trim().optional(),
    productId: z.string().uuid("Invalid Product UUID format").optional(),
    productIds: z
      .array(z.string().uuid("Invalid Product UUID format"))
      .optional()
      .default([]),
    brandIds: z
      .array(z.string().uuid("Invalid Brand UUID format"))
      .optional()
      .default([]),
    categoryIds: z
      .array(z.string().uuid("Invalid Category UUID format"))
      .optional()
      .default([]),
    measurementTypes: z
      .array(z.enum(["weight", "volume", "count", "size"]))
      .optional()
      .default([]),
    unitIds: z
      .array(z.string().uuid("Invalid Unit UUID format"))
      .optional()
      .default([]),
    isActive: z.boolean().optional(),
    outOfStock: z.boolean().optional(),
    vegType: z.enum(["veg", "nonveg", "vegan", "na"]).optional(),
    minPrice: z
      .number()
      .min(0, "minPrice must be greater than or equal to 0")
      .optional(),
    maxPrice: z
      .number()
      .min(0, "maxPrice must be greater than or equal to 0")
      .optional(),
    sortBy: z
      .enum([
        "variantName",
        "productName",
        "sku",
        "basePrice",
        "salePrice",
        "createdAt",
        "updatedAt",
      ])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.maxPrice >= data.minPrice,
    {
      message: "maxPrice cannot be less than minPrice",
      path: ["maxPrice"],
    }
  );

export type AdminVariantListInput = z.infer<typeof adminVariantListSchema>;

export const variantPriceHistoryQuerySchema = z
  .object({
    page: z.number().int().min(1, "page must be at least 1").default(1),
    pageSize: z
      .number()
      .int()
      .min(1, "pageSize must be at least 1")
      .max(100, "pageSize cannot exceed 100")
      .default(20),
    fromDate: z
      .string()
      .trim()
      .regex(
        /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
        "Invalid fromDate format (expected YYYY-MM-DD)"
      )
      .optional(),
    toDate: z
      .string()
      .trim()
      .regex(
        /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
        "Invalid toDate format (expected YYYY-MM-DD)"
      )
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .refine(
    (data) => {
      if (data.fromDate && data.toDate) {
        return new Date(data.toDate) >= new Date(data.fromDate);
      }
      return true;
    },
    {
      message: "toDate cannot be earlier than fromDate",
      path: ["toDate"],
    }
  );

export type VariantPriceHistoryQueryInput = z.infer<
  typeof variantPriceHistoryQuerySchema
>;
