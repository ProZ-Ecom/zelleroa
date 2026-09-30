import { z } from "zod";
import { vegTypeEnum } from "@/features/products/validations/admin-product.schema";

export { vegTypeEnum };

// Every Item belongs to exactly one Brand (multi-brand store). Only the Brand's
// public UUID is sent; the service resolves it to the internal id.
const brandUuid = z
  .string({ message: "Brand is required" })
  .trim()
  .min(1, "Brand is required")
  .uuid("Invalid Brand UUID format");

export const createAdminStyleSchema = z
  .object({
    brandId: brandUuid,
    name: z
      .string({ message: "Style name is required" })
      .trim()
      .min(1, "Style name cannot be empty")
      .max(200, "Style name cannot exceed 200 characters"),
    slug: z
      .string({ message: "Slug is required" })
      .trim()
      .min(1, "Slug cannot be empty")
      .max(220, "Slug cannot exceed 220 characters"),
    sku: z.string().trim().max(100, "SKU cannot exceed 100 characters").optional().nullable(),
    shortDescription: z
      .string()
      .trim()
      .max(500, "Short description cannot exceed 500 characters")
      .optional()
      .nullable(),
    description: z.string().trim().optional().nullable(),
    ingredients: z.string().trim().optional().nullable(),
    isReadyToMix: z.boolean().optional().default(false),
    cookingRecipe: z.string().trim().optional().nullable(),
    shelfLife: z
      .string()
      .trim()
      .max(100, "Shelf life cannot exceed 100 characters")
      .optional()
      .nullable(),
    vegType: vegTypeEnum.optional(),
    basePrice: z.coerce.number().min(0, "Base price cannot be negative").optional().default(0),
    isFeatured: z.boolean().optional().default(false),
    isDefault: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(false),
    outOfStock: z.boolean().optional().default(false),
  })
  .strict();

export type CreateAdminStyleInput = z.infer<typeof createAdminStyleSchema>;

export const updateAdminStyleSchema = z
  .object({
    // Optional so partial updates still work, but never nullable - an Item
    // can switch brands, not lose its brand.
    brandId: brandUuid.optional(),
    name: z
      .string()
      .trim()
      .min(1, "Style name cannot be empty")
      .max(200, "Style name cannot exceed 200 characters")
      .optional(),
    slug: z
      .string()
      .trim()
      .min(1, "Slug cannot be empty")
      .max(220, "Slug cannot exceed 220 characters")
      .optional(),
    sku: z.string().trim().max(100, "SKU cannot exceed 100 characters").optional().nullable(),
    shortDescription: z
      .string()
      .trim()
      .max(500, "Short description cannot exceed 500 characters")
      .optional()
      .nullable(),
    description: z.string().trim().optional().nullable(),
    ingredients: z.string().trim().optional().nullable(),
    isReadyToMix: z.boolean().optional(),
    cookingRecipe: z.string().trim().optional().nullable(),
    shelfLife: z
      .string()
      .trim()
      .max(100, "Shelf life cannot exceed 100 characters")
      .optional()
      .nullable(),
    vegType: vegTypeEnum.optional(),
    basePrice: z.coerce.number().min(0, "Base price cannot be negative").optional(),
    isFeatured: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    outOfStock: z.boolean().optional(),
  })
  .strict();

export type UpdateAdminStyleInput = z.infer<typeof updateAdminStyleSchema>;

export const adminStyleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
  productId: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
});

export type AdminStyleListQueryInput = z.infer<typeof adminStyleListQuerySchema>;
