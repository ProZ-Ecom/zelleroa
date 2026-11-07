import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Cannot exceed ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const purchaseReturnStatusEnum = z.enum(["DRAFT", "SUBMITTED", "COMPLETED", "CANCELLED"]);

export const purchaseReturnReasonEnum = z.enum([
  "DAMAGED",
  "WRONG_ITEM",
  "EXPIRED",
  "SHORT_SUPPLY",
  "QUALITY",
  "OTHER",
]);

const returnItemSchema = z
  .object({
    purchaseOrderItemId: z.coerce.number().int().positive("Select a purchase line"),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
    reason: purchaseReturnReasonEnum,
    notes: optionalText(255),
  })
  .strict();

const returnBodySchema = z.object({
  returnDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Return date must be YYYY-MM-DD")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  debitNoteNumber: optionalText(60),
  notes: optionalText(500),
  items: z
    .array(returnItemSchema)
    .min(1, "Add at least one item")
    .refine(
      (items) => new Set(items.map((i) => i.purchaseOrderItemId)).size === items.length,
      "The same purchase line is added more than once"
    ),
});

export const createPurchaseReturnSchema = returnBodySchema
  .extend({ purchaseOrderId: z.string().trim().uuid("Select a purchase order") })
  .strict();

export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;

/** The purchase order a return was raised against never changes, so it is not editable. */
export const updatePurchaseReturnSchema = returnBodySchema.strict();

export type UpdatePurchaseReturnInput = z.infer<typeof updatePurchaseReturnSchema>;

export const purchaseReturnActionSchema = z
  .object({
    action: z.enum(["submit", "complete", "cancel"]),
    /** Required to cancel, so the reason is on the record. */
    reason: z.string().trim().max(255).optional(),
    /** The vendor's acknowledgement, usually known at completion. */
    debitNoteNumber: optionalText(60),
  })
  .strict();

export type PurchaseReturnActionInput = z.infer<typeof purchaseReturnActionSchema>;

export const purchaseReturnsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10).optional(),
  search: z.string().trim().optional(),
  status: purchaseReturnStatusEnum.optional(),
  vendorId: z.string().trim().optional(),
});
