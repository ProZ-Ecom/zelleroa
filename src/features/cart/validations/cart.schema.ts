import { z } from "zod";

export const addCartItemSchema = z
  .object({
    variantUnitPriceId: z
      .string()
      .min(1, "variantUnitPriceId cannot be empty")
      .optional(),
    variantId: z
      .string()
      .min(1, "variantId cannot be empty")
      .optional(),
    quantity: z
      .number({ message: "quantity is required" })
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1")
      .max(9999, "Quantity cannot exceed 9999"),
  })
  .refine(
    (data) => Boolean(data.variantUnitPriceId || data.variantId),
    {
      message: "Either variantUnitPriceId or variantId must be provided",
      path: ["variantUnitPriceId"],
    }
  );

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z
  .object({
    quantity: z
      .number({ message: "quantity is required" })
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1")
      .max(9999, "Quantity cannot exceed 9999"),
  })
  .strict();

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
