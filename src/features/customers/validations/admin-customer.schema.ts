import { z } from "zod";
import {
  ORDER_STATUS_ENUM,
  PAYMENT_STATUS_ENUM,
} from "@/features/orders/validations/order.schema";

export const adminCustomerListSchema = z
  .object({
    page: z.number().int().min(1, "page must be at least 1").default(1),
    pageSize: z
      .number()
      .int()
      .min(1, "pageSize must be at least 1")
      .max(100, "pageSize cannot exceed 100")
      .default(20),
    search: z.string().trim().optional(),
    status: z.enum(["active", "inactive", "banned"]).optional(),
    isActive: z.boolean().optional(),
    isBlocked: z.boolean().optional(),
    gender: z.enum(["male", "female", "other", "not_applicable"]).optional(),
    isWhatsapp: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    phoneVerified: z.boolean().optional(),
    sortBy: z
      .enum(["name", "email", "createdAt", "updatedAt", "lastLoginAt", "status"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export type AdminCustomerListInput = z.infer<typeof adminCustomerListSchema>;

export const adminCustomerOrdersSchema = z
  .object({
    page: z.number().int().min(1, "page must be at least 1").default(1),
    pageSize: z
      .number()
      .int()
      .min(1, "pageSize must be at least 1")
      .max(100, "pageSize cannot exceed 100")
      .default(20),
    status: z.enum(ORDER_STATUS_ENUM).optional(),
    paymentStatus: z.enum(PAYMENT_STATUS_ENUM).optional(),
    search: z.string().trim().optional(),
    sortBy: z
      .enum(["orderNumber", "status", "totalAmount", "placedAt", "createdAt"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export type AdminCustomerOrdersInput = z.infer<typeof adminCustomerOrdersSchema>;

export const updateCustomerStatusSchema = z
  .object({
    isActive: z.boolean(),
    blockReason: z
      .string()
      .trim()
      .max(500, "Reason must be 500 characters or fewer")
      .optional(),
  })
  .strict()
  .refine((v) => v.isActive || Boolean(v.blockReason), {
    path: ["blockReason"],
    message: "A reason is required to block this account",
  });

export type UpdateCustomerStatusInput = z.infer<typeof updateCustomerStatusSchema>;

