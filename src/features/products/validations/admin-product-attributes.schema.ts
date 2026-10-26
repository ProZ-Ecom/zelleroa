import { z } from "zod";

export const variationLevelEnum = z.enum(["VARIANT", "SKU", "INFO"]);

/**
 * Each configured attribute carries the level it varies at, because the level is
 * what decides whether it becomes a ProductVariant, joins the SKU identity, or is
 * only descriptive. Saving is a full replace, so every attribute that should stay
 * configured has to be present with its level.
 */
export const setProductAttributesSchema = z
  .object({
    attributes: z.array(
      z
        .object({
          attributeId: z.string().trim().min(1),
          variationLevel: variationLevelEnum,
        })
        .strict()
    ),
    force: z.boolean().optional().default(false),
  })
  .strict();

export type SetProductAttributesInput = z.infer<typeof setProductAttributesSchema>;
