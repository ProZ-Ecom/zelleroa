import { z } from "zod";

const upiIdRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const accountNumberRegex = /^\d{9,18}$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const createAgentSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(150),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  notes: optionalText(500),
});
export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s]{7,20}$/, "Enter a valid phone number")
      .nullable()
      .optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).max(100).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export const paymentDetailsSchema = z
  .object({
    method: z.enum(["upi", "bank_transfer"]),
    upiId: z.string().trim().regex(upiIdRegex, "Enter a valid UPI ID (e.g. name@bank)").optional(),
    accountHolderName: z
      .string()
      .trim()
      .min(2, "Account holder name is required")
      .max(100)
      .regex(/^[A-Za-z .'-]+$/, "Name can only contain letters and spaces")
      .optional(),
    bankName: z.string().trim().min(2, "Bank name is required").max(100).optional(),
    accountNumber: z
      .string()
      .trim()
      .regex(accountNumberRegex, "Account number must be 9-18 digits")
      .optional(),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(ifscRegex, "Enter a valid IFSC code (e.g. HDFC0001234)")
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.method === "upi") {
      if (!v.upiId) ctx.addIssue({ code: "custom", path: ["upiId"], message: "UPI ID is required" });
    } else {
      (["accountHolderName", "bankName", "accountNumber", "ifsc"] as const).forEach((field) => {
        if (!v[field]) ctx.addIssue({ code: "custom", path: [field], message: "This field is required" });
      });
    }
  });
export type PaymentDetailsInput = z.infer<typeof paymentDetailsSchema>;

export const requestPayoutSchema = z.object({
  method: z.enum(["upi", "bank_transfer"]),
});
export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;

export const rejectPayoutSchema = z.object({
  reason: z.string().trim().min(3, "A rejection reason is required").max(255),
});

export const markPaidSchema = z.object({
  transactionReference: z
    .string()
    .trim()
    .min(3, "Transaction / reference ID is required")
    .max(100)
    .regex(/^[A-Za-z0-9\-_/. ]+$/, "Reference can only contain letters, numbers and - _ / ."),
  note: z.string().trim().max(500).optional(),
});

export const upsertRateSchema = z
  .object({
    scope: z.enum(["global", "category", "product"]),
    categoryId: z.string().trim().min(1).optional(),
    productId: z.string().trim().min(1).optional(),
    percentage: z.coerce.number().min(0, "Minimum is 0").max(100, "Maximum is 100"),
    isActive: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.scope === "category" && !v.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Select a category" });
    }
    if (v.scope === "product" && !v.productId) {
      ctx.addIssue({ code: "custom", path: ["productId"], message: "Select a product" });
    }
  });

export const changeAgentSchema = z.object({
  referralCode: z.string().trim().min(3, "Enter an agent code").max(30),
});

export const reassignSchema = z.object({
  customerId: z.string().trim().min(1),
  agentId: z.string().trim().min(1),
  reason: z.string().trim().max(255).optional(),
});

export const returnPeriodSchema = z.object({
  days: z.coerce.number().int().min(0).max(90),
});
