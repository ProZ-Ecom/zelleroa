import { z } from "zod";

export const posPaymentModeEnum = z.enum(["CASH", "UPI", "CARD"]);

export const posProductSearchSchema = z.object({
  search: z.string().trim().max(120).optional(),
  /** Exact-SKU mode: the scanner-less fast path, returns at most one row. */
  sku: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});
export type PosProductSearchInput = z.infer<typeof posProductSearchSchema>;

export const posCustomerLookupSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a 10-digit phone number"),
});
export type PosCustomerLookupInput = z.infer<typeof posCustomerLookupSchema>;

export const posShiftOpenSchema = z.object({
  /** Omitted while there is one counter; required once there are several. */
  storeId: z.coerce.number().int().positive().optional(),
  openingCash: z.coerce.number().min(0).max(10_000_000).default(0),
});
export type PosShiftOpenInput = z.infer<typeof posShiftOpenSchema>;

export const posShiftCloseSchema = z
  .object({
    countedCash: z.coerce.number().min(0).max(10_000_000),
    varianceReason: z.string().trim().max(255).optional(),
  })
  // The reason is enforced again on the server against the computed variance;
  // this only catches the obvious case before a round trip.
  .refine((v) => v.countedCash >= 0, { message: "Counted cash cannot be negative" });
export type PosShiftCloseInput = z.infer<typeof posShiftCloseSchema>;

export const posBillSchema = z
  .object({
    items: z
      .array(
        z.object({
          variantUnitPriceId: z.coerce.number().int().positive(),
          quantity: z.coerce.number().int().min(1).max(999),
        })
      )
      .min(1, "Add at least one item"),
    /** Whole-bill discount in rupees. Gated by POS_DISCOUNT and the store's cap. */
    discountAmount: z.coerce.number().min(0).default(0),
    customerPhone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Enter a 10-digit phone number")
      .optional(),
    customerName: z.string().trim().max(150).optional(),
    paymentMode: posPaymentModeEnum,
    /** Cash handed over, so the screen can show change. Cash bills only. */
    cashReceived: z.coerce.number().min(0).optional(),
    /** UPI reference or card last-4; stored on the payment, never a full card number. */
    paymentReference: z.string().trim().max(60).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.paymentMode !== "CASH" || v.cashReceived === undefined || v.cashReceived >= 0, {
    message: "Cash received cannot be negative",
    path: ["cashReceived"],
  });
export type PosBillInput = z.infer<typeof posBillSchema>;

export const posVoidSchema = z.object({
  orderUuid: z.string().trim().min(1),
  reason: z.string().trim().min(3, "A reason is required").max(255),
});
export type PosVoidInput = z.infer<typeof posVoidSchema>;

export const posShiftListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  staffUserId: z.coerce.number().int().positive().optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});
export type PosShiftListInput = z.infer<typeof posShiftListSchema>;
