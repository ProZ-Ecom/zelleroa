import { z } from "zod";
import { mobileRegex, pincodeRegex } from "./agent-profile.schema";

const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  phone: z.string().trim().regex(mobileRegex, "Enter a valid 10-digit mobile number"),
  addressLine1: z.string().trim().min(3).max(255),
  addressLine2: z.string().trim().max(255).optional().nullable(),
  landmark: z.string().trim().max(150).optional().nullable(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().trim().regex(pincodeRegex, "Enter a valid 6-digit pincode"),
});

/**
 * Exactly one of `customerId` (a customer assigned to the signed-in agent) or `manualCustomer`
 * (a buyer with no account). Prices always come from the database, never from this payload.
 */
export const agentPlaceOrderSchema = z
  .object({
    /** The agent is buying for themselves (AGENT_OWN); no customer fields are sent. */
    forSelf: z.boolean().optional(),
    customerId: z.string().trim().min(1).optional(),
    manualCustomer: z
      .object({
        name: z.string().trim().min(2).max(150),
        phone: z.string().trim().regex(mobileRegex, "Enter a valid 10-digit mobile number"),
        email: z.string().trim().email().max(254).optional().or(z.literal("")),
      })
      .optional(),
    shippingAddressId: z.string().trim().min(1).optional(),
    shippingAddress: addressSchema.optional(),
    items: z
      .array(z.object({ variantUnitPriceId: z.string().trim().min(1), quantity: z.number().int().min(1).max(999) }))
      .min(1, "Add at least one product")
      .max(50),
    deliveryMethod: z.enum(["standard", "express"]).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.forSelf) {
      if (v.customerId || v.manualCustomer) {
        ctx.addIssue({ code: "custom", path: ["forSelf"], message: "A self order cannot also name a customer" });
      }
      if (!v.shippingAddressId && !v.shippingAddress) {
        ctx.addIssue({ code: "custom", path: ["shippingAddressId"], message: "Select a delivery address" });
      }
      return;
    }
    if (!v.customerId === !v.manualCustomer) {
      ctx.addIssue({ code: "custom", path: ["customerId"], message: "Choose an assigned customer or enter a new customer's details" });
    }
    if (v.manualCustomer && !v.shippingAddress) {
      ctx.addIssue({ code: "custom", path: ["shippingAddress"], message: "Delivery address is required" });
    }
    if (v.customerId && !v.shippingAddressId && !v.shippingAddress) {
      ctx.addIssue({ code: "custom", path: ["shippingAddressId"], message: "Select a delivery address" });
    }
  });
export type AgentPlaceOrderInput = z.infer<typeof agentPlaceOrderSchema>;
