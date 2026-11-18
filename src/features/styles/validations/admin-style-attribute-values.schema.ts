import { z } from "zod";

/** The pool of attribute values a Style comes in, which variant generation
 *  fans out into Variant (Color) x Unit price (Size) rows. */
export const setStyleAttributeValuesSchema = z
  .object({
    attributeValueIds: z.array(z.string().trim().min(1)),
  })
  .strict();

export type SetStyleAttributeValuesInput = z.infer<typeof setStyleAttributeValuesSchema>;
