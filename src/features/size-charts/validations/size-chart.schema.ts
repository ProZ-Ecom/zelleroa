import { z } from "zod";

export const sizeChartGenderEnum = z.enum(["men", "women", "kids", "unisex", "not_applicable"]);

export const sizeChartQuerySchema = z.object({
  category_id: z.string().trim().min(1, "category_id is required"),
  gender: sizeChartGenderEnum,
});

export type SizeChartQueryInput = z.infer<typeof sizeChartQuerySchema>;

export const setSizeChartSchema = z
  .object({
    gender: sizeChartGenderEnum,
    attributeValueIds: z.array(z.string().trim().uuid("Invalid attribute value UUID format")),
  })
  .strict();

export type SetSizeChartInput = z.infer<typeof setSizeChartSchema>;
