import { z } from "zod";

const slug = (label: string) =>
  z.string().trim().min(1).max(220).regex(/^[a-z0-9-]+$/i, `Invalid ${label}`);

const flag = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

export const pricingListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(200).default(25).optional(),
    search: z.string().trim().max(120).optional(),
    categorySlug: slug("category").optional(),
    brandSlug: slug("brand").optional(),
    belowCost: flag,
    unpriced: flag,
    noCost: flag,
  })
  .strict();

export type PricingListQuery = z.infer<typeof pricingListQuerySchema>;

const rounding = z.enum(["none", "rupee"]).optional().default("none");
const ids = z
  .array(z.string().trim().uuid("Invalid item id"))
  .min(1, "Select at least one item")
  .max(500, "Select at most 500 items at a time");

/**
 * A bulk change names the SKUs and how to work out each new price:
 * `set` the same price on all of them, move them by a `percent` or a flat
 * `amount`, or price them from their own cost plus a `markup`. `manual`
 * carries a price per SKU instead, for edits typed row by row.
 */
export const applyPricingSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("manual"),
      prices: z
        .array(
          z.object({
            id: z.string().trim().uuid("Invalid item id"),
            sellingPrice: z.coerce.number().min(0, "Price cannot be negative").max(99999999),
          })
        )
        .min(1, "Nothing to save")
        .max(500, "Save at most 500 rows at a time"),
    })
    .strict(),
  z
    .object({
      mode: z.literal("set"),
      ids,
      value: z.coerce.number().min(0, "Price cannot be negative").max(99999999),
      rounding,
    })
    .strict(),
  z
    .object({
      mode: z.literal("percent"),
      ids,
      /** Negative lowers the price; -100 would make it free, so stop short of that. */
      value: z.coerce.number().gt(-100, "A drop of 100% or more is not allowed").max(1000),
      rounding,
    })
    .strict(),
  z
    .object({
      mode: z.literal("amount"),
      ids,
      value: z.coerce.number().min(-99999999).max(99999999),
      rounding,
    })
    .strict(),
  z
    .object({
      mode: z.literal("markup"),
      ids,
      /** Percent added to the SKU's own cost; rows with no cost are skipped. */
      value: z.coerce.number().min(0, "Markup cannot be negative").max(10000),
      rounding,
    })
    .strict(),
]);

export type ApplyPricingInput = z.infer<typeof applyPricingSchema>;
