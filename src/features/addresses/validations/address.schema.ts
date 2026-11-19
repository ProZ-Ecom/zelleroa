import { z } from "zod";
import { NAME_REGEX, NAME_INVALID_MESSAGE } from "@/lib/validations/name";

export const createAddressSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(255).regex(NAME_REGEX, NAME_INVALID_MESSAGE),
  lastName: z.string().max(255).regex(NAME_REGEX, NAME_INVALID_MESSAGE).optional(),
  phone: z
    .string()
    .min(7, "Valid phone number is required")
    .max(20, "Phone number is too long"),
  addressLine1: z.string().min(1, "Address line 1 is required").max(500),
  addressLine2: z.string().max(500).optional(),
  city: z.string().min(1, "City is required").max(255),
  state: z.string().min(1, "State is required").max(255),
  postalCode: z.string().min(3, "Pincode is required").max(20),
  country: z.string().max(255).optional(),
  isDefault: z.boolean().optional(),
});

export type CreateAddressSchemaInput = z.infer<typeof createAddressSchema>;

export const updateAddressSchema = createAddressSchema.partial();

export type UpdateAddressSchemaInput = z.infer<typeof updateAddressSchema>;
