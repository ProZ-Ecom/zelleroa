import { z } from "zod";

export const vegTypeEnum = z.enum(["veg", "nonveg", "vegan", "na"]);
export type VegType = z.infer<typeof vegTypeEnum>;

export const productGenderEnum = z.enum(["men", "women", "kids", "unisex"]);
export type ProductGender = z.infer<typeof productGenderEnum>;

export const createAdminProductSchema = z
  .object({
    categoryId: z
      .string({ message: "Category ID is required" })
      .uuid("Invalid Category UUID format"),
    brandId: z.preprocess(
      (val) => (val === "" || val === null ? undefined : val),
      z.string().uuid("Invalid Brand UUID format").optional()
    ),
    hsnCodeId: z
      .string({ message: "HSN Code ID is required" })
      .uuid("Invalid HSN Code UUID format"),
    name: z
      .string({ message: "Product name is required" })
      .trim()
      .min(1, "Product name cannot be empty")
      .max(200, "Product name cannot exceed 200 characters"),
    slug: z
      .string({ message: "Product code is required" })
      .trim()
      .min(1, "Product code cannot be empty")
      .max(220, "Product code cannot exceed 220 characters"),
    /** Audience this product is designed for - drives which size chart applies. */
    gender: productGenderEnum,
  })
  .strict();

export type CreateAdminProductInput = z.infer<typeof createAdminProductSchema>;

export const updateAdminProductSchema = createAdminProductSchema
  .partial()
  .strict();

export type UpdateAdminProductInput = z.infer<typeof updateAdminProductSchema>;

export const adminProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10).optional(),
  search: z.string().trim().optional(),
});

export type AdminProductsQueryInput = z.infer<typeof adminProductsQuerySchema>;

const optionalUuidFilter = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  return val;
}, z.string().uuid("Invalid UUID format").optional());

export const adminProductListSchema = z
  .object({
    page: z.number().int().min(1, "page must be at least 1").default(1),
    limit: z
      .number()
      .int()
      .min(1, "limit must be at least 1")
      .max(100, "limit cannot exceed 100")
      .default(10),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional(),
    search: z.string().trim().optional(),
    isActive: z.boolean().optional(),
    categoryId: optionalUuidFilter,
    brandId: optionalUuidFilter,
    hsnCodeId: optionalUuidFilter,
    status: z.boolean().optional(),
    sortBy: z
      .enum([
        "name",
        "slug",
        "createdAt",
        "updatedAt",
        "status",
        "isActive",
      ])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export type AdminProductListInput = z.infer<typeof adminProductListSchema>;

