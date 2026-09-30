import { z } from "zod";

export const headerMenuGenderEnum = z.enum(["men", "women", "kids", "unisex"]);
export type HeaderMenuGender = z.infer<typeof headerMenuGenderEnum>;

export const createAdminHeaderMenuItemSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, "Label is required")
      .max(150, "Label cannot exceed 150 characters"),
    categoryIds: z.array(z.string().trim().min(1)).default([]).optional(),
    link: z
      .string()
      .trim()
      .max(500, "Link cannot exceed 500 characters")
      .optional()
      .nullable(),
    /** Audience this nav item targets - appended as ?gender= to every link it resolves to. */
    gender: headerMenuGenderEnum.optional().nullable(),
    sortOrder: z
      .number()
      .int("Sort order must be an integer")
      .min(0, "Sort order cannot be negative")
      .default(0)
      .optional(),
    isActive: z.boolean().default(true).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasCategories = (data.categoryIds?.length ?? 0) > 0;
    const hasLink = Boolean(data.link?.trim());
    if (!hasCategories && !hasLink) {
      ctx.addIssue({
        code: "custom",
        path: ["link"],
        message: "Select a category or provide a link",
      });
    }
    if (hasCategories && hasLink) {
      ctx.addIssue({
        code: "custom",
        path: ["link"],
        message: "Choose either categories or a link, not both",
      });
    }
  });

export type CreateAdminHeaderMenuItemInput = z.infer<
  typeof createAdminHeaderMenuItemSchema
>;

export const updateAdminHeaderMenuItemSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, "Label is required")
      .max(150, "Label cannot exceed 150 characters")
      .optional(),
    categoryIds: z.array(z.string().trim().min(1)).optional(),
    link: z
      .string()
      .trim()
      .max(500, "Link cannot exceed 500 characters")
      .optional()
      .nullable(),
    gender: headerMenuGenderEnum.optional().nullable(),
    sortOrder: z
      .number()
      .int("Sort order must be an integer")
      .min(0, "Sort order cannot be negative")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdateAdminHeaderMenuItemInput = z.infer<
  typeof updateAdminHeaderMenuItemSchema
>;

export const adminHeaderMenuQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(50).optional(),
  search: z.string().trim().optional(),
});

export type AdminHeaderMenuQueryInput = z.infer<
  typeof adminHeaderMenuQuerySchema
>;
