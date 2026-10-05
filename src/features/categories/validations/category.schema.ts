import { z } from "zod";

export const getCategoriesQuerySchema = z.object({
  search: z.string().optional(),
  parentId: z.coerce.number().int().positive().optional(),
});

export type GetCategoriesQueryInput = z.infer<typeof getCategoriesQuerySchema>;

export const createCategorySchema = z.object({
  name: z
    .string({ message: "Category name is required" })
    .trim()
    .min(1, "Category name is required")
    .max(255)
    .regex(
      /^[a-zA-Z0-9\s\-&]+$/,
      "Category name can only contain letters, numbers, spaces, hyphens, and ampersands"
    ),
  slug: z
    .string()
    .trim()
    .min(1, "Category code is required")
    .max(255)
    .regex(
      /^[A-Za-z0-9_]+$/,
      "Category code can only contain letters, numbers, and underscores"
    ),
  description: z.string().max(1000).optional(),
  image: z
    .string({ message: "Category image is required" })
    .min(1, "Category image is required")
    .max(500),
  parentId: z.string().trim().nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce
    .number()
    .int("Sort order must be an integer")
    .min(0, "Sort order cannot be negative")
    .max(100, "Sort order cannot exceed 100")
    .default(0),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(1000).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
