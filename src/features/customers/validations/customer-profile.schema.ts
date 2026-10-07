import { z } from "zod";
import { NAME_REGEX, NAME_INVALID_MESSAGE } from "@/lib/validations/name";
import { mobileStoredOrInputField } from "@/lib/validations/mobile";

const indiaPhoneSchema = mobileStoredOrInputField;

export const updateCustomerProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty")
      .max(255, "Name cannot exceed 255 characters")
      .regex(NAME_REGEX, NAME_INVALID_MESSAGE)
      .optional(),
    dob: z
      .string()
      .trim()
      .refine(
        (val) => {
          if (!val) return true;
          const date = new Date(val);
          if (isNaN(date.getTime())) return false;
          // Zero out time for fair date comparison
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          return date <= today;
        },
        { message: "Date of birth cannot be a future date" }
      )
      .optional()
      .nullable(),
    gender: z.enum(["male", "female", "other", "not_applicable"]).optional().nullable(),
    isWhatsapp: z.boolean().optional(),
    whatsappNo: z
      .union([indiaPhoneSchema, z.literal(""), z.null()])
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.isWhatsapp === true) {
      if (!data.whatsappNo || (typeof data.whatsappNo === "string" && data.whatsappNo.trim() === "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "WhatsApp number is required when WhatsApp is enabled",
          path: ["whatsappNo"],
        });
      }
    }
  });

export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
