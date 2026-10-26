import { z } from "zod";
import { optionalEmailField } from "@/lib/validations/email";

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
    email: optionalEmailField.transform((v) => v ?? null),
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
    purchaseDate: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    invoiceNumber: optionalText(60),
    additionalCharges: z.coerce.number().min(0, "Charges cannot be negative").default(0),
    notes: optionalText(500),
    items: z.array(poItemSchema).min(1, "Add at least one item"),
  })
  .strict();

export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;

/**
 * A confirmed purchase line carries what the stock sheet adds on top of an
 * ordered line: how many of the delivered units were unusable, and a new
 * selling price to apply while the stock is being taken in.
 */
const confirmItemSchema = poItemSchema.extend({
  damagedQuantity: z.coerce.number().int().min(0, "Damaged quantity cannot be negative").default(0),
  sellingPrice: z.coerce
    .number()
    .min(0, "Selling price cannot be negative")
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? null : v)),
  remarks: optionalText(255),
});

export const confirmPurchaseSchema = purchaseOrderSchema
  .extend({
    idempotencyKey: z.string().trim().min(8).max(64),
    items: z
      .array(
        confirmItemSchema.refine((i) => i.damagedQuantity <= i.quantity, {
          message: "Damaged quantity cannot exceed the quantity received",
          path: ["damagedQuantity"],
        })
      )
      .min(1, "Add at least one item"),
  })
  .strict();

export type ConfirmPurchaseInput = z.infer<typeof confirmPurchaseSchema>;

const slug = (label: string) =>
  z.string().trim().min(1).max(220).regex(/^[a-z0-9-]+$/i, `Invalid ${label}`);

export const stockSheetQuerySchema = z
  .object({
    vendorId: z.string().trim().uuid("Invalid vendor id").optional(),
    categorySlug: slug("category").optional(),
    brandSlug: slug("brand").optional(),
    /** Comma-separated product slugs, as a querystring carries them. */
    productSlugs: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []))
      .pipe(z.array(slug("product")).max(50, "Select at most 50 products")),
    lowStockOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
  })
  .strict();

export type StockSheetFilters = z.infer<typeof stockSheetQuerySchema>;

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
