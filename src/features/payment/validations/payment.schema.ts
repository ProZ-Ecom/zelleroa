import { z } from "zod";

export const createRazorpayOrderSchema = z.object({
  orderId: z.string().optional(),
  shippingAddressId: z.string().optional(),
  deliveryMethod: z.enum(["standard", "express"]).default("standard").optional(),
});

export type CreateRazorpayOrderInput = z.input<typeof createRazorpayOrderSchema>;
export type CreateRazorpayOrderOutput = z.output<typeof createRazorpayOrderSchema>;

export const verifyRazorpayPaymentSchema = z.object({
  orderId: z.string().optional(),
  shippingAddressId: z.string().optional(),
  billingAddressId: z.string().optional(),
  deliveryMethod: z.enum(["standard", "express"]).default("standard").optional(),
  notes: z.string().optional(),
  razorpay_order_id: z.string().min(1, "Razorpay Order ID is required"),
  razorpay_payment_id: z.string().min(1, "Razorpay Payment ID is required"),
  razorpay_signature: z.string().min(1, "Razorpay Signature is required"),
});

export type VerifyRazorpayPaymentInput = z.input<typeof verifyRazorpayPaymentSchema>;
export type VerifyRazorpayPaymentOutput = z.output<typeof verifyRazorpayPaymentSchema>;


export interface RazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  orderNumber: string;
  internalOrderId: string;
}
