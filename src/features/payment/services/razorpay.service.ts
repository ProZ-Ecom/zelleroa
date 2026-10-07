import type { NextRequest } from "next/server";
import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { userRepository } from "@/features/users/repositories/user.repository";
import { cartService } from "@/features/cart/services/cart.service";
import { orderService } from "@/features/orders/services/order.service";
import { getRazorpayClient, getRazorpayPublicKey } from "../config/razorpay.config";
import { paymentRepository } from "../repositories/payment.repository";
import { referralService, findAgentByReferralCode } from "@/features/agents/services/referral.service";
import { getShippingCharge } from "@/features/orders/shipping";
import { assertMobileVerifiedForOrder } from "@/features/orders/lib/mobile-verification";
import type {
  CreateRazorpayOrderInput,
  VerifyRazorpayPaymentInput,
  RazorpayOrderResponse,
} from "../validations/payment.schema";

/**
 * Delivery charge for the customer's chosen address - must match what
 * orderService.createCustomerOrder charges once the payment is verified.
 */
async function resolveShippingCharge(
  userId: number | bigint,
  shippingAddressId?: string,
  deliveryMethod?: string
) {
  if (!shippingAddressId) {
    throw ApiError.badRequest("Please select a delivery address before paying.");
  }
  const isNumeric = /^\d+$/.test(shippingAddressId);
  const address = await db.customerAddress.findFirst({
    where: {
      userId,
      is_active: true,
      deleted_at: null,
      OR: [
        { uuid: shippingAddressId },
        ...(isNumeric ? [{ id: BigInt(shippingAddressId) }] : []),
      ],
    },
    select: { state: true },
  });
  if (!address) {
    throw ApiError.badRequest("Shipping address not found or does not belong to customer");
  }
  return getShippingCharge(address.state, deliveryMethod);
}

export const razorpayService = {
  /**
   * Create a Razorpay Order based on either active Cart or an existing internal order
   */
  async createRazorpayOrder(
    sessionUserId: string,
    input: CreateRazorpayOrderInput
  ): Promise<RazorpayOrderResponse> {
    const user = await userRepository.findById(sessionUserId);
    if (!user || !user.internalId) {
      throw ApiError.unauthorized("User not found");
    }
    if (!user.isActive || user.is_active === false) {
      throw ApiError.forbidden("Your account is inactive. Please contact support.");
    }

    const userId = user.internalId;
    const isCartCheckout = !input.orderId || input.orderId === "cart";

    // Refuse before any payment is taken; the order is only created after payment.
    await assertMobileVerifiedForOrder(userId);

    // A. Cart-First Flow: Create Razorpay Order directly from active cart (No internal order created yet)
    if (isCartCheckout) {
      const cart = await cartService.getCart({ sessionUserId });
      if (!cart || cart.items.length === 0) {
        throw ApiError.badRequest("Your cart is empty. Please add items before checking out.");
      }

      const payableBeforeShipping = cart.total;
      const shippingCharge = await resolveShippingCharge(
        userId,
        input.shippingAddressId,
        input.deliveryMethod
      );
      const payableAmount = payableBeforeShipping + shippingCharge;
      if (payableAmount <= 0) {
        throw ApiError.badRequest("Invalid cart payable amount.");
      }

      const amountInPaise = Math.round(payableAmount * 100);
      const razorpay = getRazorpayClient();
      let rzpOrder: any;
      try {
        rzpOrder = await razorpay.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt: `CART_${Date.now().toString().slice(-8)}`,
          notes: {
            userId: String(userId),
            checkoutType: "cart",
            shippingAddressId: input.shippingAddressId || "",
          },
        });
      } catch (err: any) {
        const description =
          err?.error?.description ||
          err?.message ||
          "Failed to communicate with Razorpay API";
        console.error("Razorpay orders.create error:", err);
        throw ApiError.badRequest(
          `Razorpay Error: ${description}. Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.`
        );
      }

      return {
        razorpayOrderId: rzpOrder.id,
        amount: Number(rzpOrder.amount),
        currency: rzpOrder.currency,
        keyId: getRazorpayPublicKey(),
        orderNumber: "New Order",
        internalOrderId: "cart",
      };
    }

    // B. Existing Order Flow: Used when retrying payment for an already created pending order
    const order = await paymentRepository.findCustomerOrder(userId, input.orderId!);
    if (!order) {
      throw ApiError.notFound("Order not found or does not belong to customer");
    }

    if (order.payment_status === "paid") {
      throw ApiError.badRequest("This order has already been paid for.");
    }

    if (order.order_status === "cancelled") {
      throw ApiError.badRequest("Cannot pay for a cancelled order.");
    }

    const payableAmount = Number(order.totalAmount);
    if (isNaN(payableAmount) || payableAmount <= 0) {
      throw ApiError.badRequest("Invalid order payable amount.");
    }

    const amountInPaise = Math.round(payableAmount * 100);

    // Check for an existing pending payment record with a valid Razorpay Order ID
    const existingPendingPayment = await paymentRepository.findPendingPayment(order.id);
    if (
      existingPendingPayment &&
      existingPendingPayment.gateway_order_id &&
      Number(existingPendingPayment.amount) === payableAmount
    ) {
      return {
        razorpayOrderId: existingPendingPayment.gateway_order_id,
        amount: amountInPaise,
        currency: "INR",
        keyId: getRazorpayPublicKey(),
        orderNumber: order.orderNumber,
        internalOrderId: order.uuid || String(order.id),
      };
    }

    const razorpay = getRazorpayClient();
    let rzpOrder: any;
    try {
      rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: order.orderNumber,
        notes: {
          orderId: String(order.id),
          orderUuid: order.uuid || "",
          orderNumber: order.orderNumber,
          userId: String(userId),
        },
      });
    } catch (err: any) {
      const description =
        err?.error?.description ||
        err?.message ||
        "Failed to communicate with Razorpay API";
      console.error("Razorpay orders.create error:", err);
      throw ApiError.badRequest(
        `Razorpay Error: ${description}. Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.`
      );
    }

    const paymentMethod = await paymentRepository.getOrCreatePaymentMethod(
      "RAZORPAY",
      "Razorpay Online Payment"
    );

    await paymentRepository.createPaymentRecord({
      orderId: order.id,
      paymentMethodId: paymentMethod.id,
      amount: payableAmount,
      currency: "INR",
      gatewayOrderId: rzpOrder.id,
      createdBy: userId,
    });

    return {
      razorpayOrderId: rzpOrder.id,
      amount: Number(rzpOrder.amount),
      currency: rzpOrder.currency,
      keyId: getRazorpayPublicKey(),
      orderNumber: order.orderNumber,
      internalOrderId: order.uuid || String(order.id),
    };
  },

  /**
   * Cryptographically verify Razorpay signature and confirm order on success
   */
  async verifyPaymentSignature(
    sessionUserId: string,
    input: VerifyRazorpayPaymentInput,
    request?: NextRequest
  ) {
    const user = await userRepository.findById(sessionUserId);
    if (!user || !user.internalId) {
      throw ApiError.unauthorized("User not found");
    }

    const userId = user.internalId;
    const isCartCheckout = !input.orderId || input.orderId === "cart";

    // 1. Cryptographic Signature Verification
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      throw new Error("RAZORPAY_KEY_SECRET is not configured");
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
      .digest("hex");

    const isSignatureValid = expectedSignature === input.razorpay_signature;

    if (!isSignatureValid) {
      throw ApiError.badRequest("Invalid payment signature. Verification rejected.");
    }

    // 2. Handle Cart-First Payment Verification:
    // Create the order in the database ONLY NOW, after signature is cryptographically verified!
    if (isCartCheckout) {
      if (!input.shippingAddressId) {
        throw ApiError.badRequest("Shipping address is required to complete the order.");
      }

      // Replay guard: one verified Razorpay order may only ever produce one order.
      const alreadyUsed = await db.payment.findFirst({
        where: { gateway_order_id: input.razorpay_order_id, status: "success" },
        select: { id: true },
      });
      if (alreadyUsed) {
        throw ApiError.conflict("This payment has already been used for an order.");
      }

      // Amount that was actually charged, straight from Razorpay.
      let chargedAmount: number | undefined;
      try {
        const rzpOrder: any = await getRazorpayClient().orders.fetch(input.razorpay_order_id);
        chargedAmount = Number(rzpOrder.amount) / 100;
      } catch (err) {
        console.error("Razorpay orders.fetch failed during verification:", err);
        throw ApiError.badRequest("Could not confirm the payment amount. Please contact support.");
      }

      const createdOrder = await orderService.createCustomerOrder(sessionUserId, {
        shippingAddressId: input.shippingAddressId,
        billingAddressId: input.billingAddressId || input.shippingAddressId,
        notes: input.notes,
        deliveryMethod: input.deliveryMethod,
        paymentMethod: "CARD",
        paymentDetails: {
          gateway: "RAZORPAY",
          isPaid: true,
          razorpay_order_id: input.razorpay_order_id,
          razorpay_payment_id: input.razorpay_payment_id,
          razorpay_signature: input.razorpay_signature,
        },
      }, request, undefined, { gatewayPaymentVerified: true, expectedPaidAmount: chargedAmount });

      // Find the created order to retrieve internal BigInt ID
      const dbOrder = await db.order.findFirst({
        where: {
          OR: [
            { uuid: createdOrder.id },
            { orderNumber: createdOrder.orderNumber },
          ],
        },
        select: { id: true, uuid: true, orderNumber: true, totalAmount: true },
      });

      if (dbOrder) {
        const paymentMethod = await paymentRepository.getOrCreatePaymentMethod(
          "RAZORPAY",
          "Razorpay Online Payment"
        );

        const paymentRecord = await paymentRepository.createPaymentRecord({
          orderId: dbOrder.id,
          paymentMethodId: paymentMethod.id,
          amount: Number(dbOrder.totalAmount),
          currency: "INR",
          gatewayOrderId: input.razorpay_order_id,
          createdBy: userId,
        });

        await paymentRepository.recordPaymentSuccess({
          paymentId: paymentRecord.id,
          orderId: dbOrder.id,
          userId,
          razorpayPaymentId: input.razorpay_payment_id,
          gatewayResponse: {
            razorpay_order_id: input.razorpay_order_id,
            razorpay_payment_id: input.razorpay_payment_id,
            razorpay_signature: input.razorpay_signature,
          },
          amount: Number(dbOrder.totalAmount),
        });
      }

      return {
        success: true,
        message: "Payment verified and order placed successfully",
        orderNumber: createdOrder.orderNumber,
        orderId: createdOrder.id,
      };
    }

    // 3. Handle Existing Order Verification
    const order = await paymentRepository.findCustomerOrder(userId, input.orderId!);
    if (!order) {
      throw ApiError.notFound("Order not found or does not belong to customer");
    }

    const payment = await paymentRepository.findPendingPayment(
      order.id,
      input.razorpay_order_id
    );

    if (!payment) {
      throw ApiError.notFound("Matching payment record not found for this order");
    }

    if (payment.status === "success" && order.payment_status === "paid") {
      return {
        success: true,
        message: "Payment already verified",
        orderNumber: order.orderNumber,
        orderId: order.uuid || String(order.id),
      };
    }

    const result = await paymentRepository.recordPaymentSuccess({
      paymentId: payment.id,
      orderId: order.id,
      userId,
      razorpayPaymentId: input.razorpay_payment_id,
      gatewayResponse: {
        razorpay_order_id: input.razorpay_order_id,
        razorpay_payment_id: input.razorpay_payment_id,
        razorpay_signature: input.razorpay_signature,
      },
      amount: Number(order.totalAmount),
    });

    return {
      success: true,
      message: "Payment verified successfully",
      orderNumber: result.order.orderNumber,
      orderId: result.order.uuid || String(result.order.id),
    };
  },

  /**
   * Handle server-to-server Razorpay webhooks idempotently
   */
  async handleWebhook(rawBody: string, signatureHeader: string | null) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
    }

    if (!signatureHeader) {
      throw ApiError.badRequest("Missing Razorpay webhook signature header");
    }

    // 1. Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signatureHeader) {
      throw ApiError.badRequest("Invalid webhook signature");
    }

    // 2. Parse event payload
    const event = JSON.parse(rawBody);
    const eventType = event.event as string;

    // We specifically handle payment captured or order paid events
    if (eventType === "order.paid" || eventType === "payment.captured") {
      const paymentEntity = event.payload?.payment?.entity;
      const gatewayOrderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
      const gatewayPaymentId = paymentEntity?.id;

      if (!gatewayOrderId) {
        return { received: true, ignored: "No gateway order id found in event" };
      }

      // Find local payment record
      const paymentRecord = await paymentRepository.findPaymentByGatewayOrderId(gatewayOrderId);
      if (!paymentRecord) {
        return { received: true, ignored: "Payment record not found locally" };
      }

      // Idempotency: if already success, do not double-process
      if (paymentRecord.status === "success" && paymentRecord.order.payment_status === "paid") {
        return { received: true, duplicate: true };
      }

      const order = paymentRecord.order;
      await paymentRepository.recordPaymentSuccess({
        paymentId: paymentRecord.id,
        orderId: order.id,
        userId: order.userId,
        razorpayPaymentId: gatewayPaymentId || "webhook_captured",
        gatewayResponse: event,
        amount: Number(order.totalAmount),
      });

      return { received: true, processed: true };
    }

    if (eventType === "payment.failed") {
      const paymentEntity = event.payload?.payment?.entity;
      const gatewayOrderId = paymentEntity?.order_id;
      const errorDescription =
        paymentEntity?.error_description || "Payment failed via webhook notification";

      if (gatewayOrderId) {
        const paymentRecord = await paymentRepository.findPaymentByGatewayOrderId(gatewayOrderId);
        if (paymentRecord && paymentRecord.status !== "success") {
          await paymentRepository.recordPaymentFailure({
            paymentId: paymentRecord.id,
            orderId: paymentRecord.order.id,
            userId: paymentRecord.order.userId,
            errorReason: errorDescription,
            gatewayResponse: event,
            amount: Number(paymentRecord.order.totalAmount),
          });
        }
      }

      return { received: true, processed: true };
    }

    return { received: true, unhandledEvent: eventType };
  },

  /**
   * Refund an existing captured Razorpay payment
   */
  async refundPayment(params: {
    orderId: bigint;
    amount?: number;
    reason?: string;
  }) {
    const payment = await paymentRepository.findPendingPayment(params.orderId);
    const successPayment = await db.payment.findFirst({
      where: {
        orderId: params.orderId,
        status: "success",
        gateway: "RAZORPAY",
        is_active: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!successPayment || !successPayment.gateway_payment_id) {
      throw ApiError.badRequest("No captured Razorpay payment found for this order to refund.");
    }

    const refundAmountInPaise = params.amount
      ? Math.round(params.amount * 100)
      : Math.round(Number(successPayment.amount) * 100);

    const razorpay = getRazorpayClient();
    const refund = await razorpay.payments.refund(successPayment.gateway_payment_id, {
      amount: refundAmountInPaise,
      notes: {
        orderId: String(params.orderId),
        reason: params.reason || "Order cancellation refund",
      },
    });

    // Record refund transaction
    await db.$transaction(async (tx) => {
      await tx.paymentTransaction.create({
        data: {
          paymentId: successPayment.id,
          transaction_type: "refund",
          amount: refundAmountInPaise / 100,
          status: "refunded",
          gatewayResponse: refund as any,
          created_by: successPayment.created_by,
          updated_by: successPayment.updated_by,
        },
      });

      await tx.payment.update({
        where: { id: successPayment.id },
        data: {
          status: "refunded",
        },
      });

      await tx.order.update({
        where: { id: params.orderId },
        data: {
          payment_status: "refunded",
        },
      });
    });

    return refund;
  },

  // ─── Redirect Flow ───────────────────────────────────────────────────────────

  /**
   * Initiate a redirect-based payment: create a Razorpay order from the active
   * cart and persist a one-time token the payment app will use to retrieve details.
   * NO internal order is created here.
   */
  async initiateRedirectPayment(
    sessionUserId: string,
    input: {
      shippingAddressId: string;
      billingAddressId?: string;
      notes?: string;
      deliveryMethod?: "standard" | "express";
    },
    request?: NextRequest
  ): Promise<{ paymentUrl: string; token: string }> {
    const user = await userRepository.findById(sessionUserId);
    if (!user || !user.internalId) throw ApiError.unauthorized("User not found");
    if (!user.isActive || user.is_active === false)
      throw ApiError.forbidden("Your account is inactive. Please contact support.");

    const userId = user.internalId;

    // Refuse before any payment is taken; the order is only created after payment.
    await assertMobileVerifiedForOrder(userId);

    // 1. Compute amount from active cart
    const cart = await cartService.getCart({ sessionUserId });
    if (!cart || cart.items.length === 0)
      throw ApiError.badRequest("Your cart is empty. Please add items before checking out.");

    const payableBeforeShipping = cart.total;
    const shippingCharge = await resolveShippingCharge(
      userId,
      input.shippingAddressId,
      input.deliveryMethod
    );
    const payableAmount = payableBeforeShipping + shippingCharge;
    if (payableAmount <= 0) throw ApiError.badRequest("Invalid cart amount.");

    const amountInPaise = Math.round(payableAmount * 100);

    // 2. Create Razorpay order
    const razorpay = getRazorpayClient();
    let rzpOrder: any;
    try {
      rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `REDIR_${Date.now().toString().slice(-8)}`,
        notes: {
          userId: String(userId),
          checkoutType: "redirect",
          shippingAddressId: input.shippingAddressId,
          deliveryMethod: input.deliveryMethod || "standard",
        },
      });
    } catch (err: any) {
      const description = err?.error?.description || err?.message || "Razorpay API error";
      throw ApiError.badRequest(`Razorpay Error: ${description}`);
    }

    // 3. Generate one-time token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // The payment app verifies the payment server-to-server with no access to
    // this browser's cookies, so the referral active right now must be frozen
    // onto the token and carried through to order creation at verify time.
    const referral = await referralService.resolveForOrder(BigInt(userId), request);
    const encodedNotes = input.deliveryMethod === "express"
      ? `[DELIVERY:express] ${input.notes || ""}`.trim()
      : input.notes;

    await paymentRepository.createPaymentToken({
      token,
      razorpayOrderId: rzpOrder.id,
      internalOrderRef: "cart",
      shippingAddressId: input.shippingAddressId,
      billingAddressId: input.billingAddressId,
      notes: encodedNotes,
      referralCode: referral?.referralCode ?? null,
      amount: payableAmount,
      currency: "INR",
      orderNumber: undefined,
      keyId: getRazorpayPublicKey(),
      userId,
      expiresAt,
    });

    // 4. Build redirect URL pointing to payment app
    const paymentAppUrl =
      process.env.PAYMENT_APP_URL || "http://localhost:3001";
    const paymentUrl = `${paymentAppUrl}/?token=${token}`;

    return { paymentUrl, token };
  },

  /**
   * Verify Razorpay signature from the payment app redirect callback.
   * Creates the internal order only after successful verification.
   * Marks the one-time token as used.
   */
  async verifyRedirectPayment(input: {
    token: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<{ orderNumber: string; orderId: string; success: boolean }> {
    // 1. Validate token
    const tokenData = await paymentRepository.findValidToken(input.token);
    if (!tokenData) {
      throw ApiError.badRequest("Payment token is invalid, expired, or already used.");
    }

    // 2. Cryptographic signature verification
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not configured");

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== input.razorpay_signature) {
      throw ApiError.badRequest("Invalid payment signature. Verification rejected.");
    }

    // The signed Razorpay order must be the one this token was issued for;
    // otherwise a cheap, genuinely-paid order could unlock a costlier cart.
    if (input.razorpay_order_id !== tokenData.razorpayOrderId) {
      throw ApiError.badRequest("Payment does not match this checkout session.");
    }

    // 3. Claim the token atomically (prevent replay / double submit)
    if (!(await paymentRepository.markTokenUsed(input.token))) {
      throw ApiError.badRequest("Payment token is invalid, expired, or already used.");
    }

    // 4. Reconstruct sessionUserId from stored userId
    const userRows = await db.$queryRaw<any[]>`
      SELECT uuid FROM \`users\` WHERE id = ${tokenData.userId} LIMIT 1
    `;
    if (!userRows || userRows.length === 0) {
      throw ApiError.unauthorized("User not found");
    }
    const sessionUserId = userRows[0].uuid as string;

    // Re-validate the referral captured when this token was created (agent
    // could since have been deactivated) - never trust it blindly at verify time.
    const referral = tokenData.referralCode
      ? await findAgentByReferralCode(tokenData.referralCode)
      : null;
    const validReferral = referral && referral.id !== tokenData.userId ? referral : null;

    const rawNotes = tokenData.notes || "";
    const isExpress = rawNotes.includes("[DELIVERY:express]");
    const cleanNotes = rawNotes.replace(/\[DELIVERY:(express|standard)\]\s*/g, "").trim() || undefined;
    const deliveryMethod: "standard" | "express" = isExpress ? "express" : "standard";

    // 5. Create internal order — only now, after verified payment
    const createdOrder = await orderService.createCustomerOrder(
      sessionUserId,
      {
        shippingAddressId: tokenData.shippingAddressId,
        billingAddressId: tokenData.billingAddressId || tokenData.shippingAddressId,
        notes: cleanNotes,
        deliveryMethod,
        paymentMethod: "CARD",
        paymentDetails: {
          gateway: "RAZORPAY",
          isPaid: true,
          razorpay_order_id: input.razorpay_order_id,
          razorpay_payment_id: input.razorpay_payment_id,
          razorpay_signature: input.razorpay_signature,
        },
      },
      undefined,
      validReferral,
      { gatewayPaymentVerified: true, expectedPaidAmount: tokenData.amount }
    );

    // 6. Record payment in DB
    const dbOrder = await db.order.findFirst({
      where: {
        OR: [
          { uuid: createdOrder.id },
          { orderNumber: createdOrder.orderNumber },
        ],
      },
      select: { id: true, uuid: true, orderNumber: true, totalAmount: true },
    });

    if (dbOrder) {
      const paymentMethod = await paymentRepository.getOrCreatePaymentMethod(
        "RAZORPAY",
        "Razorpay Online Payment"
      );
      const paymentRecord = await paymentRepository.createPaymentRecord({
        orderId: dbOrder.id,
        paymentMethodId: paymentMethod.id,
        amount: Number(dbOrder.totalAmount),
        currency: "INR",
        gatewayOrderId: input.razorpay_order_id,
        createdBy: tokenData.userId,
      });
      await paymentRepository.recordPaymentSuccess({
        paymentId: paymentRecord.id,
        orderId: dbOrder.id,
        userId: tokenData.userId,
        razorpayPaymentId: input.razorpay_payment_id,
        gatewayResponse: {
          razorpay_order_id: input.razorpay_order_id,
          razorpay_payment_id: input.razorpay_payment_id,
          razorpay_signature: input.razorpay_signature,
        },
        amount: Number(dbOrder.totalAmount),
      });
    }

    return {
      success: true,
      orderNumber: createdOrder.orderNumber,
      orderId: createdOrder.id,
    };
  },
};


