import { z } from "zod";

export const OFFER_LEVELS = ["product", "item"] as const;
export const OFFER_TYPES = ["percentage", "flat", "special_price", "bxgy"] as const;
export const OFFER_STATUSES = ["active", "inactive", "scheduled", "expired"] as const;

const uuid = z.string().trim().min(1);

/** `""` from an untouched form field means "not provided", not "set to empty". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined ? null : v));

const optionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : null;
  });

const dateString = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Enter a valid date");

// ---------------------------------------------------------------------------
// List / filter query
// ---------------------------------------------------------------------------

export const getOffersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  level: z.enum(OFFER_LEVELS).optional(),
  type: z.enum(OFFER_TYPES).optional(),
  status: z.enum(OFFER_STATUSES).optional(),
  categoryId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  sortBy: z
    .enum(["name", "priority", "startsAt", "endsAt", "createdAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type GetOffersQueryInput = z.infer<typeof getOffersQuerySchema>;

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

const offerBaseSchema = z.object({
  name: z.string().trim().min(1, "Offer name is required").max(150),
  code: optionalText(50),
  level: z.enum(OFFER_LEVELS, { message: "Select an offer level" }),
  type: z.enum(OFFER_TYPES, { message: "Select an offer type" }),
  value: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isFinite(n) ? n : null;
    }),
  buyQuantity: optionalNumber,
  getQuantity: optionalNumber,
  minQuantity: z.coerce
    .number()
    .int("Minimum quantity must be a whole number")
    .min(1, "Minimum quantity must be at least 1")
    .default(1),
  maxQuantity: optionalNumber,
  minCartValue: optionalNumber,
  maxDiscountAmount: optionalNumber,
  priority: z.coerce
    .number()
    .int("Priority must be a whole number")
    .min(0, "Priority cannot be negative")
    .max(1000, "Priority cannot exceed 1000")
    .default(0),
  terms: optionalText(5000),
  startsAt: dateString,
  endsAt: dateString,
  isActive: z.boolean().default(true),
  productIds: z.array(uuid).default([]),
  itemIds: z.array(uuid).default([]),
});

type OfferBaseShape = z.infer<typeof offerBaseSchema>;

/**
 * Field-level rules can't see each other, so every rule that spans two fields
 * lives here. Shared by create and update so a PUT can't sidestep them.
 */
function applyOfferRules<T extends Partial<OfferBaseShape>>(
  data: T,
  ctx: z.RefinementCtx
) {
  const {
    level,
    type,
    value,
    startsAt,
    endsAt,
    minQuantity,
    maxQuantity,
    buyQuantity,
    getQuantity,
    minCartValue,
    maxDiscountAmount,
    productIds,
    itemIds,
  } = data;

  // Date window
  if (startsAt && endsAt) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (end.getTime() < start.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "End date cannot be before the start date",
      });
    }
  }

  // Offer type rules
  if (type === "percentage") {
    if (value == null) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Discount percentage is required",
      });
    } else if (value <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Discount percentage must be greater than 0",
      });
    } else if (value > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Discount percentage cannot exceed 100%",
      });
    }
  }

  if (type === "flat" || type === "special_price") {
    if (value == null) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message:
          type === "flat"
            ? "Discount amount is required"
            : "Special offer price is required",
      });
    } else if (value <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message:
          type === "flat"
            ? "Discount amount must be greater than 0"
            : "Special offer price must be greater than 0",
      });
    }
  }

  if (type === "bxgy") {
    if (!buyQuantity || buyQuantity < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["buyQuantity"],
        message: "Buy quantity is required and must be at least 1",
      });
    }
    if (!getQuantity || getQuantity < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["getQuantity"],
        message: "Get quantity is required and must be at least 1",
      });
    }
    if (buyQuantity && getQuantity && getQuantity > buyQuantity) {
      ctx.addIssue({
        code: "custom",
        path: ["getQuantity"],
        message: "Get quantity cannot exceed buy quantity",
      });
    }
  }

  // A cap on a special price is meaningless - the price is already absolute.
  if (type === "special_price" && maxDiscountAmount != null && maxDiscountAmount > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["maxDiscountAmount"],
      message: "Maximum discount does not apply to a special offer price",
    });
  }

  // Quantity rules
  if (maxQuantity != null) {
    if (maxQuantity < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["maxQuantity"],
        message: "Maximum quantity must be at least 1",
      });
    } else if (minQuantity != null && maxQuantity < minQuantity) {
      ctx.addIssue({
        code: "custom",
        path: ["maxQuantity"],
        message: "Maximum quantity cannot be less than the minimum quantity",
      });
    }
  }

  if (type === "bxgy" && buyQuantity && minQuantity != null && minQuantity > buyQuantity) {
    ctx.addIssue({
      code: "custom",
      path: ["minQuantity"],
      message: "Minimum quantity cannot exceed the buy quantity",
    });
  }

  if (minCartValue != null && minCartValue < 0) {
    ctx.addIssue({
      code: "custom",
      path: ["minCartValue"],
      message: "Minimum cart value cannot be negative",
    });
  }

  if (maxDiscountAmount != null && maxDiscountAmount < 0) {
    ctx.addIssue({
      code: "custom",
      path: ["maxDiscountAmount"],
      message: "Maximum discount amount cannot be negative",
    });
  }

  // Target rules - only the selection matching the level is considered, so a
  // stale selection left behind by switching tabs can't leak into the offer.
  if (level === "product" && productIds !== undefined && productIds.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["productIds"],
      message: "Select at least one product for a product-wise offer",
    });
  }

  if (level === "item" && itemIds !== undefined && itemIds.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["itemIds"],
      message: "Select at least one item/variant for an item-wise offer",
    });
  }
}

export const createOfferSchema = offerBaseSchema.superRefine(applyOfferRules);
export type CreateOfferSchemaInput = z.input<typeof createOfferSchema>;
export type CreateOfferSchemaOutput = z.output<typeof createOfferSchema>;

export const updateOfferSchema = offerBaseSchema.partial().superRefine(applyOfferRules);
export type UpdateOfferSchemaInput = z.input<typeof updateOfferSchema>;
export type UpdateOfferSchemaOutput = z.output<typeof updateOfferSchema>;

export const offerStatusSchema = z.object({
  isActive: z.boolean(),
});
export type OfferStatusInput = z.infer<typeof offerStatusSchema>;

// ---------------------------------------------------------------------------
// Offer target pickers (dependent dropdowns)
// ---------------------------------------------------------------------------

export const offerTargetQuerySchema = z.object({
  categoryId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type OfferTargetQueryInput = z.infer<typeof offerTargetQuerySchema>;
