import { z } from "zod";

const tagName = z
  .string()
  .trim()
  .min(1, "Tag name is required")
  .max(100, "Tag name cannot exceed 100 characters");

export const createAdminTagSchema = z
  .object({
    name: tagName,
    isActive: z.boolean().default(true).optional(),
  })
  .strict();

export type CreateAdminTagInput = z.infer<typeof createAdminTagSchema>;

export const updateAdminTagSchema = z
  .object({
    name: tagName.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdateAdminTagInput = z.infer<typeof updateAdminTagSchema>;

export const adminTagQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).default(50).optional(),
  search: z.string().trim().optional(),
});

export type AdminTagQueryInput = z.infer<typeof adminTagQuerySchema>;

/** `add`/`remove` change only the listed products; `set` makes the list the tag's full product set. */
export const assignTagProductsSchema = z
  .object({
    productIds: z.array(z.string().trim().min(1)).max(1000),
    action: z.enum(["add", "remove", "set"]).default("add"),
  })
  .strict();

export type AssignTagProductsInput = z.infer<typeof assignTagProductsSchema>;
