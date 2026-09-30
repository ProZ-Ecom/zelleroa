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
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export type RequestActionInput = z.infer<typeof requestActionSchema>;

export const rejectReturnSchema = requestActionSchema;
export type RejectReturnInput = RequestActionInput;
