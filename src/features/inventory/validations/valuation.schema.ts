import { z } from "zod";

const slug = (label: string) =>
  z.string().trim().min(1).max(220).regex(/^[a-z0-9-]+$/i, `Invalid ${label}`);

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

export const valuationQuerySchema = z
  .object({
    /** "stock" values what is on hand; "sales" works out margin on what was sold. */
    view: z.enum(["stock", "sales"]).default("stock").optional(),
    groupBy: z.enum(["category", "brand"]).default("category").optional(),
    categorySlug: slug("category").optional(),
    brandSlug: slug("brand").optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "The start date must come before the end date",
    path: ["from"],
  });

export type ValuationQuery = z.infer<typeof valuationQuerySchema>;
