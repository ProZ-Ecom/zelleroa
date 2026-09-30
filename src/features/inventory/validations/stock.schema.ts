import { z } from "zod";

export const movementTypeEnum = z.enum(["PURCHASE", "SALE", "RETURN", "REPLACEMENT", "ADJUSTMENT"]);

export const stockListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  color: z.string().trim().optional(),
  variantUnitPriceId: z.coerce.number().int().positive().optional(),
  status: z.enum(["in_stock", "low_stock", "out_of_stock"]).optional(),
});
export type StockListQuery = z.infer<typeof stockListQuerySchema>;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const movementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  type: movementTypeEnum.optional(),
  variantUnitPriceId: z.coerce.number().int().positive().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});
export type MovementListQuery = z.infer<typeof movementListQuerySchema>;

export const adjustmentSchema = z
  .object({
    variantUnitPriceId: z.coerce.number().int().positive("Select a product"),
    direction: z.enum(["in", "out"]),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
    reason: z.string().trim().min(3, "A reason is required").max(255),
  })
  .strict();
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;

export const stockSettingsSchema = z
  .object({ lowStockThreshold: z.coerce.number().int().min(0).max(100000) })
  .strict();
