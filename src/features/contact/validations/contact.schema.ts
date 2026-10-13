import { z } from "zod";
import { NAME_REGEX } from "@/lib/validations/name";
import { emailField, EMAIL_MAX_LENGTH } from "@/lib/validations/email";
import { normalizeIndianMobile } from "@/lib/phone";

export const CONTACT_NAME_MAX_LENGTH = 150;
export const CONTACT_PHONE_MAX_LENGTH = 20;

/**
 * Validates Full Name:
 * - Non-empty
 * - At least 2 characters, at most 150
 * - Only letters and spaces (Unicode supported)
 */
export function validateContactName(raw: string): string | null {
  const val = (raw || "").trim();
  if (!val) {
    return "Full name is required";
  }
  if (val.length < 2) {
    return "Full name must be at least 2 characters";
  }
  if (val.length > CONTACT_NAME_MAX_LENGTH) {
    return `Full name cannot exceed ${CONTACT_NAME_MAX_LENGTH} characters`;
  }
  const normalizedSpaces = val.replace(/\s+/g, " ");
  if (!NAME_REGEX.test(normalizedSpaces)) {
    return "Full name can only contain letters and spaces";
  }
  return null;
}

/**
 * Validates Email Address:
 * - Non-empty
 * - At least 5 chars, at most 254
 * - Valid RFC email syntax with domain
 */
export function validateContactEmail(raw: string): string | null {
  const val = (raw || "").trim();
  if (!val) {
    return "Email is required";
  }
  if (val.length > EMAIL_MAX_LENGTH) {
    return `Email must not exceed ${EMAIL_MAX_LENGTH} characters`;
  }
  if (val.length < 5) {
    return "Please enter a valid email address";
  }
  const res = emailField.safeParse(val);
  if (!res.success) {
    return res.error.issues[0]?.message || "Please enter a valid email address";
  }
  return null;
}

/**
 * Validates Phone Number:
 * - Non-empty
 * - Valid 10-digit Indian mobile number (6-9 prefix, bare or +91/91/0)
 * - Or valid international number with '+' prefix (10 to 15 digits)
 */
export function validateContactPhone(raw: string): string | null {
  const val = (raw || "").trim();
  if (!val) {
    return "Phone number is required";
  }

  // Remove whitespace, dashes, parentheses, dots
  const clean = val.replace(/[\s\-().]/g, "");

  // Must only contain digits and optional leading '+'
  if (!/^\+?\d+$/.test(clean)) {
    return "Phone number can only contain digits and optional '+' prefix";
  }

  // If starts with '+', international or Indian E.164
  if (clean.startsWith("+")) {
    if (clean.startsWith("+91")) {
      const national = clean.slice(3);
      if (!national) {
        return "Please enter a 10-digit mobile number after +91";
      }
      if (!/^[6-9]/.test(national)) {
        return "Mobile number must start with 6, 7, 8, or 9";
      }
      if (national.length < 10) {
        return "Phone number must be at least 10 digits";
      }
      if (national.length > 10) {
        return "Phone number cannot exceed 10 digits after +91";
      }
      return null;
    }
    const digitsOnly = clean.slice(1);
    if (digitsOnly.length < 10) {
      return "Phone number must be at least 10 digits";
    }
    if (digitsOnly.length > 15) {
      return "Phone number cannot exceed 15 digits";
    }
    return null;
  }

  // Indian number with 91 prefix without plus: 91XXXXXXXXXX (12 digits)
  if (clean.startsWith("91") && clean.length > 2) {
    const national = clean.slice(2);
    if (!/^[6-9]/.test(national)) {
      return "Mobile number must start with 6, 7, 8, or 9";
    }
    if (national.length < 10) {
      return "Phone number must be at least 10 digits";
    }
    if (national.length > 10) {
      return "Phone number cannot exceed 10 digits";
    }
    return null;
  }

  // Indian number with 0 prefix: 0XXXXXXXXXX (11 digits)
  if (clean.startsWith("0") && clean.length > 1) {
    const national = clean.slice(1);
    if (!/^[6-9]/.test(national)) {
      return "Mobile number must start with 6, 7, 8, or 9";
    }
    if (national.length < 10) {
      return "Phone number must be at least 10 digits";
    }
    if (national.length > 10) {
      return "Phone number cannot exceed 10 digits";
    }
    return null;
  }

  // Standard bare mobile number
  if (!/^[6-9]/.test(clean)) {
    return "Mobile number must start with 6, 7, 8, or 9";
  }
  if (clean.length < 10) {
    return "Phone number must be at least 10 digits";
  }
  if (clean.length > 10) {
    return "Phone number cannot exceed 10 digits";
  }

  return null;
}

export function validateContactSubject(raw: string): string | null {
  const val = (raw || "").trim();
  if (!val) {
    return "Subject is required";
  }
  if (val.length > 200) {
    return "Subject cannot exceed 200 characters";
  }
  return null;
}

export function validateContactMessage(raw: string): string | null {
  const val = (raw || "").trim();
  if (!val) {
    return "Message is required";
  }
  if (val.length > 3000) {
    return "Message cannot exceed 3000 characters";
  }
  return null;
}

export function validateContactField(
  field: "name" | "email" | "phone" | "subject" | "message",
  value: string
): string | null {
  switch (field) {
    case "name":
      return validateContactName(value);
    case "email":
      return validateContactEmail(value);
    case "phone":
      return validateContactPhone(value);
    case "subject":
      return validateContactSubject(value);
    case "message":
      return validateContactMessage(value);
    default:
      return null;
  }
}

export const contactNameSchema = z
  .string({ message: "Full name is required" })
  .trim()
  .min(1, "Full name is required")
  .min(2, "Full name must be at least 2 characters")
  .max(CONTACT_NAME_MAX_LENGTH, `Full name cannot exceed ${CONTACT_NAME_MAX_LENGTH} characters`)
  .superRefine((val, ctx) => {
    const error = validateContactName(val);
    if (error) ctx.addIssue({ code: "custom", message: error });
  })
  .transform((val) => val.replace(/\s+/g, " "));

export const contactPhoneSchema = z
  .string({ message: "Phone number is required" })
  .trim()
  .min(1, "Phone number is required")
  .superRefine((val, ctx) => {
    const error = validateContactPhone(val);
    if (error) ctx.addIssue({ code: "custom", message: error });
  })
  .transform((val) => {
    const normalized = normalizeIndianMobile(val);
    return normalized || val.replace(/[\s\-().]/g, "");
  });

export const contactSubjectSchema = z
  .string({ message: "Subject is required" })
  .trim()
  .min(1, "Subject is required")
  .max(200, "Subject cannot exceed 200 characters");

export const contactMessageSchema = z
  .string({ message: "Message is required" })
  .trim()
  .min(1, "Message is required")
  .max(3000, "Message cannot exceed 3000 characters");

export const createContactSchema = z
  .object({
    name: contactNameSchema,
    email: emailField,
    phone: contactPhoneSchema,
    subject: contactSubjectSchema,
    message: contactMessageSchema,
  })
  .strict();

export type CreateContactInput = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

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
