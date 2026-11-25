import { apiClient } from "@/lib/api/api-client";
import type {
  CreateRazorpayOrderInput,
  VerifyRazorpayPaymentInput,
  RecoverRazorpayPaymentInput,
  RazorpayOrderResponse,
} from "@/features/payment/validations/payment.schema";

export interface VerifyPaymentResult {
  success: boolean;
  message: string;
  orderNumber: string;
  orderId: string;
}

export interface RecoverPaymentResult {
  recovered: boolean;
  orderNumber?: string;
  orderId?: string;
  message?: string;
}

export interface InitiateRedirectResult {
  paymentUrl: string;
  token: string;
}

export const customerPaymentApi = {
  /**
   * Create Razorpay order for an existing pending customer order
   */
  async createRazorpayOrder(
    payload: CreateRazorpayOrderInput
  ): Promise<RazorpayOrderResponse> {
    const response = await apiClient.post<RazorpayOrderResponse>(
      "/api/customer/payment/create-order",
      payload
    );
    if (!response.data) {
      throw new Error(response.message || "Failed to create Razorpay order");
    }
    return response.data;
  },

  /**
   * Verify Razorpay payment signature after customer completes payment in modal
   */
  async verifyPayment(
    payload: VerifyRazorpayPaymentInput
  ): Promise<VerifyPaymentResult> {
    const response = await apiClient.post<VerifyPaymentResult>(
      "/api/customer/payment/verify",
      payload
    );
    if (!response.data) {
      throw new Error(response.message || "Failed to verify payment");
    }
    return response.data;
  },

  /**
   * Recover an in-flight Razorpay payment after a browser refresh or interrupted callback
   */
  async recoverPayment(
    payload: RecoverRazorpayPaymentInput
  ): Promise<RecoverPaymentResult> {
    const response = await apiClient.post<RecoverPaymentResult>(
      "/api/customer/payment/recover",
      payload
    );
    if (!response.data) {
      throw new Error(response.message || "Failed to recover payment");
    }
    return response.data;
  },

  /**
   * Initiate a redirect-based payment.
   * Returns the URL to redirect the customer to (payment app).
   */
  async initiateRedirectPayment(payload: {
    shippingAddressId: string;
    billingAddressId?: string;
    notes?: string;
    deliveryMethod?: "standard" | "express";
  }): Promise<InitiateRedirectResult> {
    const response = await apiClient.post<InitiateRedirectResult>(
      "/api/payment/initiate-redirect",
      payload
    );
    if (!response.data) {
      throw new Error(response.message || "Failed to initiate redirect payment");
    }
    return response.data;
  },
};

