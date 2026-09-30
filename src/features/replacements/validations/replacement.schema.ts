import { z } from "zod";
import { REPLACEMENT_REASONS, REPLACEMENT_STATUSES, UNBOXING_VIDEO_URL_PREFIX } from "@/features/returns/lib/policy";
import { refineReasonDescription } from "@/features/returns/validations/return.schema";

export const submitReplacementSchema = z
  .object({
    reason: z
      .string({ error: "Replacement reason is required" })
      .trim()
      .min(1, "Replacement reason is required")
      .refine((v) => (REPLACEMENT_REASONS as readonly string[]).includes(v), "Invalid replacement reason"),
    description: z.string().trim().max(1000, "Description is too long").optional(),
    unboxingVideoUrl: z
      .string({ error: "Unboxing video is mandatory" })
      .trim()
      .min(1, "Unboxing video is mandatory")
      .max(500)
      .refine((v) => v.startsWith(UNBOXING_VIDEO_URL_PREFIX), "Invalid unboxing video"),
    items: z
      .array(
        z
          .object({
            orderItemId: z.string().uuid("Invalid order item UUID"),
            quantity: z.number().int().min(1, "Quantity must be at least 1"),
            /** variant_unit_price uuid of the wanted size; omitted = same size. */
            requestedVariantUnitPriceId: z.string().uuid("Invalid size").optional(),
          })
          .strict()
      )
      .min(1, "Select at least one item to replace")
      .refine((items) => new Set(items.map((i) => i.orderItemId)).size === items.length, {
        message: "Duplicate order items are not allowed in the same request",
      }),
  })
  .strict()
  .superRefine(refineReasonDescription);

export type SubmitReplacementInput = z.infer<typeof submitReplacementSchema>;

export const customerReplacementListSchema = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    status: z.enum(REPLACEMENT_STATUSES).optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "requestedAt", "approvedAt"]).default("requestedAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();
export type ReplacementListInput = z.infer<typeof customerReplacementListSchema>;
export const adminReplacementListSchema = customerReplacementListSchema;
