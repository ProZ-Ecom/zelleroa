import { z } from "zod";

export const attributeTypeSchema = z.enum(["text", "color"]);

export type AttributeTypeInput = z.infer<typeof attributeTypeSchema>;

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const initialAttributeValueSchema = z
  .object({
    value: z.string().trim().min(1).max(150),
    colorHex: z
      .string()
      .trim()
      .regex(HEX_COLOR_REGEX, "Color code must be a valid hex value like #000000")
      .optional(),
    imageUrl: z.string().trim().max(255).optional(),
  })
  .strict();

export const createAdminAttributeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Attribute name is required")
      .max(100, "Attribute name cannot exceed 100 characters"),
    slug: z
      .string()
      .trim()
      .min(1, "Attribute code is required")
      .max(120, "Attribute code cannot exceed 120 characters")
      .regex(
        /^[A-Za-z0-9_]+$/,
        "Attribute code can only contain letters, numbers, and underscores"
      ),
    type: attributeTypeSchema.optional().default("text"),
    /** When true (default) an Item can pick several of this attribute's
     * values; when false only a single value can be selected per Item. */
    multipleSelection: z.boolean().optional().default(true),
    values: z
      .array(initialAttributeValueSchema)
      .min(1, "At least one value is required"),
  })
  .strict();

export type CreateAdminAttributeInput = z.infer<
  typeof createAdminAttributeSchema
>;

export const updateAdminAttributeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Attribute name is required")
      .max(100, "Attribute name cannot exceed 100 characters")
      .optional(),
    slug: z
      .string()
      .trim()
      .min(1, "Attribute code is required")
      .max(120, "Attribute code cannot exceed 120 characters")
      .regex(
        /^[A-Za-z0-9_]+$/,
        "Attribute code can only contain letters, numbers, and underscores"
      )
      .optional(),
    type: attributeTypeSchema.optional(),
    multipleSelection: z.boolean().optional(),
  })
  .strict();

export type UpdateAdminAttributeInput = z.infer<
  typeof updateAdminAttributeSchema
>;

export const adminAttributesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10).optional(),
  search: z.string().trim().optional(),
  type: attributeTypeSchema.optional(),
  multipleSelection: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

export type AdminAttributesQueryInput = z.infer<
  typeof adminAttributesQuerySchema
>;

export const createAttributeValueSchema = z
  .object({
    value: z
      .string()
      .trim()
      .min(1, "Value is required")
      .max(150, "Value cannot exceed 150 characters"),
    colorHex: z
      .string()
      .trim()
      .regex(HEX_COLOR_REGEX, "Color code must be a valid hex value like #000000")
      .optional(),
    imageUrl: z.string().trim().max(255).optional(),
    /** Amount added to the base price whenever this value is picked. */
    priceAdjustment: z.coerce.number().min(0).optional().default(0),
  })
  .strict();

export type CreateAttributeValueInput = z.infer<
  typeof createAttributeValueSchema
>;

export const updateAttributeValueSchema = createAttributeValueSchema.partial().strict();

export type UpdateAttributeValueInput = z.infer<
  typeof updateAttributeValueSchema
>;
