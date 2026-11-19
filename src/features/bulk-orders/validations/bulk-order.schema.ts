import { z } from "zod";
import { NAME_REGEX, NAME_INVALID_MESSAGE } from "@/lib/validations/name";
import { emailField } from "@/lib/validations/email";

export const createBulkOrderSchema = z
  .object({
    name: z
      .string({ message: "Name is required" })
      .trim()
      .min(1, "Name is required")
      .max(150, "Name cannot exceed 150 characters")
      .regex(NAME_REGEX, NAME_INVALID_MESSAGE),
    email: emailField,
    phone: z
      .string({ message: "Phone number is required" })
      .trim()
      .min(1, "Phone number is required")
      .min(5, "Phone number must be at least 5 digits")
      .max(20, "Phone number cannot exceed 20 characters"),
    companyName: z
      .string()
      .trim()
      .max(150, "Company name cannot exceed 150 characters")
      .optional()
      .or(z.literal("")),
    productInterest: z
      .string()
      .trim()
      .max(255, "Product interest cannot exceed 255 characters")
      .optional()
      .or(z.literal("")),
    quantity: z
      .number({ message: "Quantity is required" })
      .int("Quantity must be a whole number")
      .min(1, "Quantity must be at least 1"),
    message: z
      .string()
      .trim()
      .max(2000, "Message cannot exceed 2000 characters")
      .optional()
      .or(z.literal("")),
  })
  .strict();

export type CreateBulkOrderInput = z.infer<typeof createBulkOrderSchema>;

export const adminBulkOrderListSchema = z
  .object({
    page: z.number().int().min(1, "page must be at least 1").default(1),
    pageSize: z
      .number()
      .int()
      .min(1, "pageSize must be at least 1")
      .max(100, "pageSize cannot exceed 100")
      .default(20),
    limit: z.number().int().min(1).max(100).optional(),
    search: z.string().trim().optional(),
    status: z.enum(["new", "contacted", "closed"]).optional(),
    sortBy: z
      .enum(["name", "email", "quantity", "status", "createdAt", "updatedAt"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export type AdminBulkOrderListInput = z.infer<typeof adminBulkOrderListSchema>;

export const updateBulkOrderStatusSchema = z
  .object({
    status: z.enum(["new", "contacted", "closed"], {
      message: "Status must be 'new', 'contacted', or 'closed'",
    }),
    comment: z
      .string()
      .trim()
      .max(2000, "Comment cannot exceed 2000 characters")
      .optional()
      .or(z.literal("")),
  })
  .strict();

export type UpdateBulkOrderStatusInput = z.infer<typeof updateBulkOrderStatusSchema>;

export const bulkOrderUuidParamSchema = z.object({
  uuid: z.string().uuid("Invalid Bulk Order Enquiry UUID format"),
});

export type BulkOrderUuidParamInput = z.infer<typeof bulkOrderUuidParamSchema>;
