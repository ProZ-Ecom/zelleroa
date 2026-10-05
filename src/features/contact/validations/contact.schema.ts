import { z } from "zod";

export const createContactSchema = z
  .object({
    name: z
      .string({ message: "Name is required" })
      .trim()
      .min(1, "Name is required")
      .max(150, "Name cannot exceed 150 characters"),
    email: z
      .string({ message: "Email is required" })
      .trim()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .regex(
        /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address with a valid domain (e.g. name@example.com)"
      )
      .max(150, "Email cannot exceed 150 characters"),
    phone: z
      .string({ message: "Phone is required" })
      .trim()
      .min(1, "Phone is required")
      .regex(/^\+?[0-9]{10,15}$/, "Please enter a valid phone number (10 to 15 digits)")
      .max(20, "Phone number cannot exceed 20 characters"),
    subject: z
      .string({ message: "Subject is required" })
      .trim()
      .min(1, "Subject is required")
      .max(200, "Subject cannot exceed 200 characters"),
    message: z
      .string({ message: "Message is required" })
      .trim()
      .min(1, "Message is required"),
  })
  .strict();

export type CreateContactInput = z.infer<typeof createContactSchema>;

export const adminContactListSchema = z
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
    status: z.enum(["new", "read", "replied"]).optional(),
    sortBy: z
      .enum(["name", "email", "subject", "status", "createdAt", "updatedAt"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export type AdminContactListInput = z.infer<typeof adminContactListSchema>;

export const updateContactStatusSchema = z
  .object({
    status: z.enum(["new", "read", "replied"], {
      message: "Status must be 'new', 'read', or 'replied'",
    }),
  })
  .strict();

export type UpdateContactStatusInput = z.infer<typeof updateContactStatusSchema>;

export const replyContactSchema = z
  .object({
    message: z
      .string({ message: "Reply message is required" })
      .trim()
      .min(1, "Reply message cannot be empty"),
  })
  .strict();

export type ReplyContactInput = z.infer<typeof replyContactSchema>;

export const contactUuidParamSchema = z.object({
  uuid: z.string().uuid("Invalid Contact Message UUID format"),
});

export type ContactUuidParamInput = z.infer<typeof contactUuidParamSchema>;
