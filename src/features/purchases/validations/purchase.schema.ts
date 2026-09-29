import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Cannot exceed ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const vendorSchema = z
  .object({
    name: z.string().trim().min(1, "Vendor name is required").max(150),
    contactPerson: optionalText(120),
    phone: optionalText(20),
    email: z
      .string()
      .trim()
      .email("Invalid email")
      .max(150)
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    gstin: optionalText(20),
    address: optionalText(500),
    notes: optionalText(500),
    isActive: z.boolean().optional(),
  })
  .strict();

export type VendorInput = z.infer<typeof vendorSchema>;

export const vendorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10).optional(),
  search: z.string().trim().optional(),
});

export const purchaseStatusEnum = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);

const poItemSchema = z.object({
  variantUnitPriceId: z.coerce.number().int().positive("Select a product"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitCost: z.coerce.number().min(0, "Cost cannot be negative").default(0),
});

export const purchaseOrderSchema = z
  .object({
    vendorId: z.string().min(1, "Vendor is required"),
    expectedDate: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    notes: optionalText(500),
    items: z.array(poItemSchema).min(1, "Add at least one item"),
  })
  .strict();

export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;

export const purchaseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10).optional(),
  search: z.string().trim().optional(),
  status: purchaseStatusEnum.optional(),
  vendorId: z.string().optional(),
});

export const purchaseActionSchema = z
  .object({
    action: z.enum(["submit", "approve", "reject", "order", "cancel"]),
    reason: z.string().trim().max(255).optional(),
  })
  .strict();

export type PurchaseActionInput = z.infer<typeof purchaseActionSchema>;

export const receiveSchema = z
  .object({
    notes: optionalText(500),
    items: z
      .array(
        z.object({
          itemId: z.coerce.number().int().positive(),
          quantity: z.coerce.number().int().min(0),
        })
      )
      .min(1),
  })
  .strict();

export type ReceiveInput = z.infer<typeof receiveSchema>;

export const productSearchQuerySchema = z.object({
  search: z.string().trim().optional(),
});
