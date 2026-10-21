import { z } from "zod";
import {
  RETURN_REASONS,
  RETURN_STATUSES,
  UNBOXING_VIDEO_URL_PREFIX,
} from "../lib/policy";

const videoUrl = z
  .string({ error: "Unboxing video is mandatory" })
  .trim()
  .min(1, "Unboxing video is mandatory")
  .max(500)
  .refine((v) => v.startsWith(UNBOXING_VIDEO_URL_PREFIX), "Invalid unboxing video");

/** Reason + description rule shared by returns and replacements. */
export function refineReasonDescription<
  T extends { reason: string; description?: string | undefined },
>(data: T, ctx: z.RefinementCtx) {
  if (data.reason === "Other" && (data.description?.trim().length ?? 0) < 5) {
    ctx.addIssue({
      code: "custom",
      path: ["description"],
      message: "Please describe the issue when selecting 'Other'",
    });
  }
}

export const createReturnItemSchema = z
  .object({
    orderItemId: z.string().uuid("Invalid order item UUID"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
  })
  .strict();

export type CreateReturnItemInput = z.infer<typeof createReturnItemSchema>;

export const codRefundDetailsSchema = z
  .object({
    method: z.enum(["bank_transfer", "upi"]),
    accountHolderName: z.string().trim().max(150).optional(),
    bankName: z.string().trim().max(150).optional(),
    accountNumber: z.string().trim().max(30).optional(),
    confirmAccountNumber: z.string().trim().max(30).optional(),
    ifscCode: z.string().trim().max(15).optional(),
    upiId: z.string().trim().max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.method === "bank_transfer") {
      if (!data.accountHolderName || data.accountHolderName.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["accountHolderName"],
          message: "Account holder name is required (at least 2 characters)",
        });
      }
      if (!data.accountNumber || !/^\d{9,18}$/.test(data.accountNumber)) {
        ctx.addIssue({
          code: "custom",
          path: ["accountNumber"],
          message: "Please enter a valid bank account number (9 to 18 digits)",
        });
      }
      if (data.accountNumber !== data.confirmAccountNumber) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmAccountNumber"],
          message: "Account numbers do not match",
        });
      }
      if (!data.ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(data.ifscCode)) {
        ctx.addIssue({
          code: "custom",
          path: ["ifscCode"],
          message: "Please enter a valid 11-character IFSC code (e.g. HDFC0001234)",
        });
      }
    } else if (data.method === "upi") {
      if (!data.upiId || !/^[\w.-]+@[\w.-]+$/.test(data.upiId)) {
        ctx.addIssue({
          code: "custom",
          path: ["upiId"],
          message: "Please enter a valid UPI ID (e.g. name@okaxis)",
        });
      }
    }
  });

export type CodRefundDetailsInput = z.infer<typeof codRefundDetailsSchema>;

/** Body of POST /api/customer/orders/:uuid/return (order comes from the URL). */
export const submitReturnSchema = z
  .object({
    reason: z
      .string({ error: "Return reason is required" })
      .trim()
      .min(1, "Return reason is required")
      .refine((v) => (RETURN_REASONS as readonly string[]).includes(v), "Invalid return reason"),
    description: z.string().trim().max(1000, "Description is too long").optional(),
    unboxingVideoUrl: videoUrl,
    items: z
      .array(createReturnItemSchema)
      .min(1, "Select at least one item to return")
      .refine((items) => new Set(items.map((i) => i.orderItemId)).size === items.length, {
        message: "Duplicate order items are not allowed in the same request",
      }),
    codRefundDetails: codRefundDetailsSchema.optional(),
  })
  .strict()
  .superRefine(refineReasonDescription);

export type SubmitReturnInput = z.infer<typeof submitReturnSchema>;

const listBase = {
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(RETURN_STATUSES).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
};

export const customerReturnListSchema = z
  .object({
    ...listBase,
    sortBy: z.enum(["createdAt", "updatedAt", "requestedAt", "approvedAt"]).default("requestedAt"),
  })
  .strict();
export type CustomerReturnListInput = z.infer<typeof customerReturnListSchema>;

export const adminReturnListSchema = customerReturnListSchema;
export type AdminReturnListInput = CustomerReturnListInput;

export const returnUuidParamSchema = z.object({
  uuid: z.string().uuid("Invalid return UUID format"),
});
export type ReturnUuidParamInput = z.infer<typeof returnUuidParamSchema>;

/** Admin action payload: reason is enforced per action in the service. */
export const requestActionSchema = z
  .object({
    comment: z.string().trim().max(500).optional(),
    rejectionReason: z.string().trim().max(500).optional(),
    pickupDate: z.string().trim().max(40).optional(),
    transactionRef: z.string().trim().max(100).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export type RequestActionInput = z.infer<typeof requestActionSchema>;

export const rejectReturnSchema = requestActionSchema;
export type RejectReturnInput = RequestActionInput;
