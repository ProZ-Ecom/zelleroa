import { z } from "zod";
import { NAME_REGEX, NAME_INVALID_MESSAGE } from "@/lib/validations/name";

export const addToCartSchema = z.object({
  productId: z.number().int().positive("Product is required"),
  variantId: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().min(1, "Quantity must be at least 1").default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export const orderSchema = z.object({
  addressId: z.number().int().positive("Address is required"),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum([
    "CASH_ON_DELIVERY",
    "CREDIT_CARD",
    "DEBIT_CARD",
    "UPI",
    "NET_BANKING",
    "WALLET",
  ]),
});

export const customerAddressSchema = z.object({
  firstName: z.string().min(1, "First name is required").regex(NAME_REGEX, NAME_INVALID_MESSAGE),
  lastName: z.string().min(1, "Last name is required").regex(NAME_REGEX, NAME_INVALID_MESSAGE),
  phone: z.string().min(10, "Phone number is required"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(6, "Postal code is required"),
  country: z.string().default("India"),
  isDefault: z.boolean().default(false),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
