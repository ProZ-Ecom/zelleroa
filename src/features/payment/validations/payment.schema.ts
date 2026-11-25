import { z } from "zod";

export const createRazorpayOrderSchema = z.object({
  orderId: z.string().optional(),
  shippingAddressId: z.string().optional(),
  billingAddressId: z.string().optional(),
  notes: z.string().max(500).optional(),
  couponCode: z.string().trim().max(50).optional(),
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
  couponCode: z.string().trim().max(50).optional(),
  razorpay_order_id: z.string().min(1, "Razorpay Order ID is required"),
  razorpay_payment_id: z.string().min(1, "Razorpay Payment ID is required"),
  razorpay_signature: z.string().min(1, "Razorpay Signature is required"),
});

export type VerifyRazorpayPaymentInput = z.input<typeof verifyRazorpayPaymentSchema>;
export type VerifyRazorpayPaymentOutput = z.output<typeof verifyRazorpayPaymentSchema>;

export const recoverRazorpayPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, "Razorpay Order ID is required"),
  shippingAddressId: z.string().optional(),
  billingAddressId: z.string().optional(),
  deliveryMethod: z.enum(["standard", "express"]).default("standard").optional(),
  notes: z.string().max(500).optional(),
  couponCode: z.string().trim().max(50).optional(),
});

export type RecoverRazorpayPaymentInput = z.input<typeof recoverRazorpayPaymentSchema>;


export interface RazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  orderNumber: string;
  internalOrderId: string;
}
