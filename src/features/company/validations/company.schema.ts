import { z } from "zod";
import { optionalEmailField } from "@/lib/validations/email";
import { mobileStoredOrInputField } from "@/lib/validations/mobile";

const emptyStringToNull = (val: unknown) => {
  if (typeof val === "string" && val.trim() === "") return null;
  return val;
};

export const indiaPhoneSchema = z.preprocess(
  emptyStringToNull,
  mobileStoredOrInputField.nullable().optional()
);

export const pincodeSchema = z.preprocess(
  emptyStringToNull,
  z
    .string()
    .trim()
    .refine((val) => /^\d{6}$/.test(val), {
      message: "Pincode must be a valid 6-digit Indian postal code (e.g. 600001)",
    })
    .nullable()
    .optional()
);

export const emailSchema = optionalEmailField;

export const updateCompanySchema = z
  .object({
    companyName: z
      .string({ message: "Company name must be a string" })
      .trim()
      .min(1, "Company name cannot be empty")
      .max(200, "Company name cannot exceed 200 characters")
      .optional(),
    logo: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(500, "Logo URL cannot exceed 500 characters").nullable().optional()
    ),
    email: emailSchema,
    phone: indiaPhoneSchema,
    address: z.preprocess(
      emptyStringToNull,
      z.string().trim().nullable().optional()
    ),
    city: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(100, "City cannot exceed 100 characters").nullable().optional()
    ),
    state: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(100, "State cannot exceed 100 characters").nullable().optional()
    ),
    country: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(100, "Country cannot exceed 100 characters").default("India").nullable().optional()
    ),
    pincode: pincodeSchema,
    gstNumber: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(50, "GST number cannot exceed 50 characters").nullable().optional()
    ),
    panNumber: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(50, "PAN number cannot exceed 50 characters").nullable().optional()
    ),
    website: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(255, "Website cannot exceed 255 characters").nullable().optional()
    ),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdateCompanySchemaInput = z.infer<typeof updateCompanySchema>;
