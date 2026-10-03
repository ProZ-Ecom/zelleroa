import { z } from "zod";

export const ADDRESS_TYPE_ENUM = ["shipping", "billing"] as const;

export const indiaPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone Number is required")
  .transform((val) => {
    if (/^[6-9]\d{9}$/.test(val)) {
      return `+91${val}`;
    }
    return val;
  })
  .refine((val) => /^\+91[6-9]\d{9}$/.test(val), {
    message: "Please enter a valid 10-digit Indian phone number (e.g. 9876543210)",
  });

export const pincodeSchema = z
  .string()
  .trim()
  .min(1, "PIN Code is required")
  .refine((val) => /^\d{6}$/.test(val), {
    message: "Please enter a valid 6-digit PIN code (e.g. 637001)",
  });

const countrySchema = z
  .string()
  .trim()
  .default("India")
  .refine((val) => val.toLowerCase() === "india", {
    message: "Country must be India",
  });

export const createCustomerAddressSchema = z
  .object({
    label: z
      .string()
      .trim()
      .max(50, "Label cannot exceed 50 characters")
      .optional()
      .nullable(),
    addressType: z
      .enum(ADDRESS_TYPE_ENUM, {
        message: "Address Type must be either 'shipping' or 'billing'",
      })
      .default("shipping")
      .optional(),
    fullName: z
      .string()
      .trim()
      .min(1, "Full Name is required")
      .max(150, "Full Name cannot exceed 150 characters"),
    phone: indiaPhoneSchema,
    addressLine1: z
      .string()
      .trim()
      .min(1, "Address Line 1 is required")
      .max(255, "Address Line 1 cannot exceed 255 characters"),
    addressLine2: z
      .string()
      .trim()
      .max(255, "Address Line 2 cannot exceed 255 characters")
      .optional()
      .nullable(),
    landmark: z
      .string()
      .trim()
      .max(150, "Landmark cannot exceed 150 characters")
      .optional()
      .nullable(),
    city: z
      .string()
      .trim()
      .min(1, "City is required")
      .max(100, "City cannot exceed 100 characters"),
    state: z
      .string()
      .trim()
      .min(1, "State is required")
      .max(100, "State cannot exceed 100 characters"),
    pincode: pincodeSchema,
    country: countrySchema,
    latitude: z
      .number()
      .min(-90, "Latitude must be between -90 and 90")
      .max(90, "Latitude must be between -90 and 90")
      .optional()
      .nullable(),
    longitude: z
      .number()
      .min(-180, "Longitude must be between -180 and 180")
      .max(180, "Longitude must be between -180 and 180")
      .optional()
      .nullable(),
    isDefault: z.boolean().optional().default(false),
  })
  .strict();

export const updateCustomerAddressSchema = z
  .object({
    label: z
      .string()
      .trim()
      .max(50, "Label cannot exceed 50 characters")
      .optional()
      .nullable(),
    addressType: z
      .enum(ADDRESS_TYPE_ENUM, {
        message: "Address Type must be either 'shipping' or 'billing'",
      })
      .optional(),
    fullName: z
      .string()
      .trim()
      .min(1, "Full Name is required")
      .max(150, "Full Name cannot exceed 150 characters")
      .optional(),
    phone: indiaPhoneSchema.optional(),
    addressLine1: z
      .string()
      .trim()
      .min(1, "Address Line 1 is required")
      .max(255, "Address Line 1 cannot exceed 255 characters")
      .optional(),
    addressLine2: z
      .string()
      .trim()
      .max(255, "Address Line 2 cannot exceed 255 characters")
      .optional()
      .nullable(),
    landmark: z
      .string()
      .trim()
      .max(150, "Landmark cannot exceed 150 characters")
      .optional()
      .nullable(),
    city: z
      .string()
      .trim()
      .min(1, "City is required")
      .max(100, "City cannot exceed 100 characters")
      .optional(),
    state: z
      .string()
      .trim()
      .min(1, "State is required")
      .max(100, "State cannot exceed 100 characters")
      .optional(),
    pincode: pincodeSchema.optional(),
    country: z
      .string()
      .trim()
      .refine((val) => val.toLowerCase() === "india", {
        message: "Country must be India",
      })
      .optional(),
    latitude: z
      .number()
      .min(-90, "Latitude must be between -90 and 90")
      .max(90, "Latitude must be between -90 and 90")
      .optional()
      .nullable(),
    longitude: z
      .number()
      .min(-180, "Longitude must be between -180 and 180")
      .max(180, "Longitude must be between -180 and 180")
      .optional()
      .nullable(),
    isDefault: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one editable field must be provided for update",
  });

export const customerAddressQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  addressType: z.enum(ADDRESS_TYPE_ENUM).optional(),
});

export const customerAddressListSchema = z
  .object({
    page: z.number().int().min(1).default(1).optional(),
    pageSize: z.number().int().min(1).max(100).default(20).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    addressType: z.enum(ADDRESS_TYPE_ENUM).optional(),
  })
  .strict();

export type CreateCustomerAddressInput = z.infer<typeof createCustomerAddressSchema>;
export type UpdateCustomerAddressInput = z.infer<typeof updateCustomerAddressSchema>;
export type CustomerAddressQueryInput = z.infer<typeof customerAddressQuerySchema>;
export type CustomerAddressListInput = z.infer<typeof customerAddressListSchema>;
