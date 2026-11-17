import { z } from "zod";

export const posExchangeLookupSchema = z.object({
  query: z.string().trim().min(1, "Enter an invoice number, order number or 10-digit mobile number"),
});

export type PosExchangeLookupInput = z.infer<typeof posExchangeLookupSchema>;

export const posExchangeReturnItemInputSchema = z.object({
  orderItemId: z.number().int().positive("Invalid order item ID"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  condition: z.enum(["RESTOCKABLE", "DEFECTIVE"]),
  reason: z.string().trim().min(1, "Return reason is required"),
  reasonDetail: z.string().trim().max(500).optional().nullable(),
});

export type PosExchangeReturnItemInput = z.infer<typeof posExchangeReturnItemInputSchema>;

export const posExchangeNewItemInputSchema = z.object({
  variantUnitPriceId: z.number().int().positive("Invalid replacement product"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  isDefectiveReplacement: z.boolean().optional(),
});

export type PosExchangeNewItemInput = z.infer<typeof posExchangeNewItemInputSchema>;

export const posExchangeInputSchema = z.object({
  originalOrderId: z.number().int().positive("Original order ID is required"),
  returnItems: z
    .array(posExchangeReturnItemInputSchema)
    .min(1, "Select at least one product to return or exchange"),
  newItems: z
    .array(posExchangeNewItemInputSchema)
    .min(1, "Select at least one replacement product"),
  paymentMode: z.enum(["CASH", "UPI", "CARD"]).optional().nullable(),
  cashReceived: z.number().nonnegative().optional().nullable(),
  paymentReference: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  managerUserId: z.number().int().positive().optional().nullable(),
});

export type PosExchangeInput = z.infer<typeof posExchangeInputSchema>;
