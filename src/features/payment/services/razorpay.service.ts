import type { NextRequest } from "next/server";
import crypto from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { userRepository } from "@/features/users/repositories/user.repository";
import { cartService } from "@/features/cart/services/cart.service";
import { orderService } from "@/features/orders/services/order.service";
import { getRazorpayClient, getRazorpayPublicKey } from "../config/razorpay.config";
import { paymentRepository } from "../repositories/payment.repository";
import { referralService, findAgentByReferralCode } from "@/features/agents/services/referral.service";
import { couponValidationService } from "@/features/coupons/services/coupon-validation.service";
import { getShippingCharge } from "@/features/orders/shipping";
import { assertMobileVerifiedForOrder } from "@/features/orders/lib/mobile-verification";
import type {
  CreateRazorpayOrderInput,
  VerifyRazorpayPaymentInput,
  RecoverRazorpayPaymentInput,
  RazorpayOrderResponse,
} from "../validations/payment.schema";

/**
 * Compare two hex signatures without leaking, through how long the comparison
 * takes, how much of a forged signature was right.
 */
function signatureMatches(expected: string, received: string | null | undefined) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received || "", "utf8");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

const inFlightVerifications = new Map<
  string,
  Promise<{ success: boolean; message: string; orderNumber: string; orderId: string }>
>();

type RazorpayOrderEntity = {
  id: string;
  amount: number | string;
  currency: string;
};

type RazorpayPaymentEntity = {
  id: string;
  order_id?: string | null;
  status?: string;
  amount: number | string;
  currency?: string;
};

function extractRazorpayErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const record = err as { error?: { description?: unknown }; message?: unknown };
    if (typeof record.error?.description === "string" && record.error.description) {
      return record.error.description;
    }
    if (typeof record.message === "string" && record.message) {
      return record.message;
    }
  }
  return fallback;
}

function encodeCheckoutNotes(
  deliveryMethod?: "standard" | "express" | string,
  notes?: string | null,
  couponCode?: string | null
): string | undefined {
  const tags: string[] = [];
  if (deliveryMethod === "express") {
    tags.push("[DELIVERY:express]");
  }
  const normalizedCoupon = couponCode?.trim().toUpperCase();
  if (normalizedCoupon) {
    tags.push(`[COUPON:${normalizedCoupon}]`);
  }
  const clean = notes?.trim() || "";
  const combined = [...tags, clean].filter(Boolean).join(" ").trim();
  return combined || undefined;
}

function decodeCheckoutNotes(rawNotes?: string | null): {
  deliveryMethod: "standard" | "express";
  couponCode: string | undefined;
  notes: string | undefined;
} {
  const raw = rawNotes || "";
  const isExpress = raw.includes("[DELIVERY:express]");
  const couponMatch = raw.match(/\[COUPON:([^\]]+)\]/);
  const couponCode = couponMatch?.[1]?.trim() || undefined;
  const cleanNotes =
    raw
      .replace(/\[DELIVERY:(express|standard)\]\s*/g, "")
      .replace(/\[COUPON:[^\]]+\]\s*/g, "")
      .trim() || undefined;
  return {
    deliveryMethod: isExpress ? "express" : "standard",
    couponCode,
    notes: cleanNotes,
  };
}

async function findCommittedOrderByGatewayOrderId(
  razorpayOrderId: string,
  expectedUserId?: bigint
): Promise<{ orderNumber: string; orderId: string } | null> {
  return paymentRepository.findCommittedOrderByGatewayOrderId(razorpayOrderId, expectedUserId);
}

async function waitForCommittedOrder(
  razorpayOrderId: string,
  timeoutMs = 5000
): Promise<{ orderNumber: string; orderId: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const existing = await findCommittedOrderByGatewayOrderId(razorpayOrderId);
    if (existing) return existing;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

/**
 * Confirm with Razorpay that the payment belongs to the expected order and is
 * captured (auto-capturing an `authorized` payment if manual capture is active
 * on the live account) before writing a paid order locally.
 */
async function ensureGatewayPaymentCaptured(
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<{ chargedAmount: number }> {
  const razorpay = getRazorpayClient();
  let payment: RazorpayPaymentEntity;
  try {
    payment = (await razorpay.payments.fetch(razorpayPaymentId)) as unknown as RazorpayPaymentEntity;
  } catch (err) {
    console.error("Razorpay payments.fetch failed during verification:", err);
    throw ApiError.badRequest("Could not confirm payment status with Razorpay. Please contact support.");
  }

  if (payment.order_id && payment.order_id !== razorpayOrderId) {
    throw ApiError.badRequest("Payment does not match the Razorpay order.");
  }

  if (payment.status === "authorized") {
    try {
      payment = (await razorpay.payments.capture(
        razorpayPaymentId,
        Number(payment.amount),
        payment.currency || "INR"
      )) as unknown as RazorpayPaymentEntity;
    } catch (captureErr) {
      console.error("Razorpay payments.capture failed:", captureErr);
      throw ApiError.badRequest(
        `Payment authorization could not be captured. Please contact support with payment reference ${razorpayPaymentId}.`
      );
    }
  }

  if (payment.status !== "captured") {
    throw ApiError.badRequest(
      `Payment is not captured (current status: ${payment.status || "unknown"}).`
    );
  }

  const amountPaise = Number(payment.amount);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw ApiError.badRequest("Could not confirm the captured payment amount.");
  }

  return { chargedAmount: amountPaise / 100 };
}

/**
 * Atomically claim a cart-first Razorpay order across browser verification,
 * webhook delivery, and refresh-recovery so only one path ever creates the
 * order or issues a refund on failure.
 */
async function finalizeCartCheckoutOrder(params: {
  sessionUserId: string;
  userId: bigint;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  shippingAddressId: string;
  billingAddressId?: string;
  deliveryMethod: "standard" | "express";
  notes?: string;
  couponCode?: string;
  referralCode?: string | null;
  request?: NextRequest;
}): Promise<{
  success: boolean;
  alreadyCompleted: boolean;
  orderNumber: string;
  orderId: string;
}> {
  const alreadyCommitted = await findCommittedOrderByGatewayOrderId(params.razorpayOrderId);
  if (alreadyCommitted) {
    return {
      success: true,
      alreadyCompleted: true,
      ...alreadyCommitted,
    };
  }

  const { chargedAmount } = await ensureGatewayPaymentCaptured(
    params.razorpayOrderId,
    params.razorpayPaymentId
  );

  // DB-level atomic lock: if a checkout token exists, only the single caller
  // that flips is_used 0 -> 1 may create the order or refund on failure.
  const tokenRow = await paymentRepository.findTokenByRazorpayOrderId(params.razorpayOrderId);
  if (tokenRow) {
    const claimed = await paymentRepository.claimByRazorpayOrderId(params.razorpayOrderId);
    if (!claimed) {
      const winnerOrder = await waitForCommittedOrder(params.razorpayOrderId);
      if (winnerOrder) {
        return {
          success: true,
          alreadyCompleted: true,
          ...winnerOrder,
        };
      }
      throw ApiError.conflict(
        "This payment has already been processed or is being finalized. Please check My Orders."
      );
    }
  }

  const referral = params.referralCode
    ? await findAgentByReferralCode(params.referralCode)
    : null;
  const validReferral = referral && referral.id !== params.userId ? referral : undefined;

  let createdOrder;
  try {
    createdOrder = await orderService.createCustomerOrder(
      params.sessionUserId,
      {
        shippingAddressId: params.shippingAddressId,
        billingAddressId: params.billingAddressId || params.shippingAddressId,
        notes: params.notes,
        couponCode: params.couponCode,
        deliveryMethod: params.deliveryMethod,
        paymentMethod: "CARD",
        paymentDetails: {
          gateway: "RAZORPAY",
          isPaid: true,
          razorpay_order_id: params.razorpayOrderId,
          razorpay_payment_id: params.razorpayPaymentId,
          razorpay_signature: params.razorpaySignature,
        },
      },
      params.request,
      validReferral,
      { gatewayPaymentVerified: true, expectedPaidAmount: chargedAmount }
    );
  } catch (orderErr: unknown) {
    const committedAfterErr = await findCommittedOrderByGatewayOrderId(params.razorpayOrderId);
    if (committedAfterErr) {
      return {
        success: true,
        alreadyCompleted: true,
        ...committedAfterErr,
      };
    }

    const baseMsg =
      orderErr instanceof Error
        ? orderErr.message
        : "Could not complete order due to stock unavailability.";
    const refunded = await refundCapturedPayment(
      params.razorpayPaymentId,
      params.razorpayOrderId,
      baseMsg
    );
    throw ApiError.badRequest(
      refunded
        ? `${baseMsg} A full refund has been automatically initiated to your payment method.`
        : `${baseMsg} We could not complete the refund automatically - please contact support with payment reference ${params.razorpayPaymentId}.`
    );
  }

  const dbOrder = await db.order.findFirst({
    where: {
      OR: [{ uuid: createdOrder.id }, { orderNumber: createdOrder.orderNumber }],
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
      gatewayOrderId: params.razorpayOrderId,
      createdBy: params.userId,
    });

    await paymentRepository.recordPaymentSuccess({
      paymentId: paymentRecord.id,
      orderId: dbOrder.id,
      userId: params.userId,
      razorpayPaymentId: params.razorpayPaymentId,
      gatewayResponse: {
        razorpay_order_id: params.razorpayOrderId,
        razorpay_payment_id: params.razorpayPaymentId,
        razorpay_signature: params.razorpaySignature,
      },
      amount: Number(dbOrder.totalAmount),
    });
  }

  return {
    success: true,
    alreadyCompleted: false,
    orderNumber: createdOrder.orderNumber,
    orderId: createdOrder.id,
  };
}

/**
 * The money is already captured by the time the order is written, so a failure
 * there (stock gone, cart total moved) must hand the money back rather than
 * leave the customer paid up with nothing to show for it. A refund that itself
 * fails is logged loudly and still reported to the customer, because support
 * has to be able to find it.
 */
async function refundCapturedPayment(
  razorpayPaymentId: string,
  razorpayOrderId: string,
  reason: string
) {
  try {
    await getRazorpayClient().payments.refund(razorpayPaymentId, {
      notes: { reason, razorpay_order_id: razorpayOrderId },
    });
    console.warn(
      `[Razorpay] Auto-refunded payment ${razorpayPaymentId} after order placement failed: ${reason}`
    );
    return true;
  } catch (refundErr: unknown) {
    console.error(
      `[Razorpay] CRITICAL: auto-refund failed for payment ${razorpayPaymentId} (order ${razorpayOrderId}):`,
      refundErr
    );
    return false;
  }
}

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
    input: CreateRazorpayOrderInput,
    request?: NextRequest
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

      // Check real-time stock and gather coupon pricing lines before creating Razorpay order
      const couponLines: Array<{
        productId: bigint;
        categoryId: bigint | null;
        unitPrice: number;
        quantity: number;
      }> = [];

      for (const item of cart.items) {
        if (!item.variantUnitPriceId) continue;
        const vup = await db.variantUnitPrice.findFirst({
          where: {
            OR: [
              { uuid: item.variantUnitPriceId },
              ...(isNaN(Number(item.variantUnitPriceId)) ? [] : [{ id: BigInt(item.variantUnitPriceId) }]),
            ],
            deleted_at: null,
          },
          include: {
            variant: {
              include: {
                style: {
                  select: {
                    product: { select: { id: true, categoryId: true } },
                  },
                },
              },
            },
            inventories: {
              select: { quantity_available: true, quantity_reserved: true },
            },
          },
        });

        if (!vup || !vup.isActive || vup.deleted_at !== null) {
          throw ApiError.badRequest(
            `"${item.productName}" is no longer available. Please remove it from your cart.`
          );
        }

        const variant = vup.variant;
        if (!variant || !variant.isActive || variant.deleted_at !== null || variant.out_of_stock) {
          throw ApiError.badRequest(
            `"${item.productName}" is out of stock. Please remove it from your cart.`
          );
        }

        // Ensure sufficient available stock before initiating live payment
        const rawAvailable = vup.inventories?.quantity_available ?? 0;
        const reserved = vup.inventories?.quantity_reserved || 0;
        const effectiveStock = Math.max(0, rawAvailable - reserved);

        if (effectiveStock < item.quantity) {
          throw ApiError.badRequest(
            effectiveStock === 0
              ? `"${item.productName}" is out of stock. Please remove it from your cart.`
              : `Only ${effectiveStock} unit${effectiveStock === 1 ? "" : "s"} left for "${item.productName}". Please update your cart.`
          );
        }

        const product = variant.style?.product;
        if (product) {
          couponLines.push({
            productId: product.id,
            categoryId: product.categoryId,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          });
        }
      }

      let couponDiscount = 0;
      let validatedCouponCode: string | undefined;
      if (input.couponCode) {
        const validated = await couponValidationService.validate(
          input.couponCode,
          BigInt(userId),
          couponLines
        );
        couponDiscount = validated.discountAmount;
        validatedCouponCode = validated.code;
      }

      const payableBeforeShipping = Math.max(0, cart.total - couponDiscount);
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
      let rzpOrder: RazorpayOrderEntity;
      try {
        rzpOrder = (await razorpay.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt: `CART_${Date.now().toString().slice(-8)}`,
          notes: {
            userId: String(userId),
            checkoutType: "cart",
            shippingAddressId: input.shippingAddressId || "",
            deliveryMethod: input.deliveryMethod || "standard",
            ...(validatedCouponCode ? { couponCode: validatedCouponCode } : {}),
          },
        })) as unknown as RazorpayOrderEntity;
      } catch (err: unknown) {
        const description = extractRazorpayErrorMessage(
          err,
          "Failed to communicate with Razorpay API"
        );
        console.error("Razorpay orders.create error:", err);
        throw ApiError.badRequest(
          `Razorpay Error: ${description}. Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.`
        );
      }

      // Persist checkout intent by razorpayOrderId so webhooks or post-refresh
      // recovery can still create the order if the browser disconnects/refreshes.
      if (input.shippingAddressId) {
        const referral = await referralService.resolveForOrder(BigInt(userId), request);
        const encodedNotes = encodeCheckoutNotes(
          input.deliveryMethod,
          input.notes,
          validatedCouponCode
        );
        await paymentRepository.createPaymentToken({
          token: crypto.randomBytes(32).toString("hex"),
          razorpayOrderId: rzpOrder.id,
          internalOrderRef: "cart",
          shippingAddressId: input.shippingAddressId,
          billingAddressId: input.billingAddressId || input.shippingAddressId,
          notes: encodedNotes,
          referralCode: referral?.referralCode ?? null,
          amount: payableAmount,
          currency: "INR",
          orderNumber: undefined,
          keyId: getRazorpayPublicKey(),
          userId,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        });
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

    // For COD orders, allow payment only after delivery.
    // Restrict payment during Processing, Packing, and Shipped stages.
    const payment = order.payments?.[0];
    const paymentMethodCode = payment?.payment_methods?.code?.toUpperCase();
    const isCodOrder = !payment || paymentMethodCode === "COD" || payment.gateway === "COD";

    if (isCodOrder) {
      const allowedCodPayStatuses = ["delivered"];
      if (!allowedCodPayStatuses.includes(order.order_status.toLowerCase())) {
        throw ApiError.badRequest(
          `For Cash on Delivery orders, payment is allowed only after delivery. Payment cannot be made during ${order.order_status} stage.`
        );
      }
    }

    const payableAmount = Number(order.totalAmount);
    if (isNaN(payableAmount) || payableAmount <= 0) {
      throw ApiError.badRequest("Invalid order payable amount.");
    }

    const amountInPaise = Math.round(payableAmount * 100);

    // Check for an existing pending Razorpay payment record with a valid Razorpay Order ID
    const existingPendingPayment = await paymentRepository.findPendingPayment(order.id);
    if (
      existingPendingPayment &&
      existingPendingPayment.status === "pending" &&
      existingPendingPayment.gateway === "RAZORPAY" &&
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
    let rzpOrder: RazorpayOrderEntity;
    try {
      rzpOrder = (await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: order.orderNumber,
        notes: {
          orderId: String(order.id),
          orderUuid: order.uuid || "",
          orderNumber: order.orderNumber,
          userId: String(userId),
        },
      })) as unknown as RazorpayOrderEntity;
    } catch (err: unknown) {
      const description = extractRazorpayErrorMessage(
        err,
        "Failed to communicate with Razorpay API"
      );
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
    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!secret) {
      throw new Error("RAZORPAY_KEY_SECRET is not configured");
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
      .digest("hex");

    if (!signatureMatches(expectedSignature, input.razorpay_signature)) {
      throw ApiError.badRequest("Invalid payment signature. Verification rejected.");
    }

    // 2. Handle Cart-First Payment Verification:
    // Create the order in the database ONLY NOW, after signature is cryptographically verified!
    if (isCartCheckout) {
      if (!input.shippingAddressId) {
        throw ApiError.badRequest("Shipping address is required to complete the order.");
      }

      const existingInFlight = inFlightVerifications.get(input.razorpay_order_id);
      if (existingInFlight) {
        return existingInFlight;
      }

      const verificationPromise = (async () => {
        const tokenRow = await paymentRepository.findTokenByRazorpayOrderId(input.razorpay_order_id);
        const decodedToken = tokenRow ? decodeCheckoutNotes(tokenRow.notes) : undefined;
        const result = await finalizeCartCheckoutOrder({
          sessionUserId,
          userId: BigInt(userId),
          razorpayOrderId: input.razorpay_order_id,
          razorpayPaymentId: input.razorpay_payment_id,
          razorpaySignature: input.razorpay_signature,
          shippingAddressId: input.shippingAddressId!,
          billingAddressId: input.billingAddressId || tokenRow?.billingAddressId || input.shippingAddressId,
          deliveryMethod:
            (input.deliveryMethod as "standard" | "express") ||
            decodedToken?.deliveryMethod ||
            "standard",
          notes: input.notes ?? decodedToken?.notes,
          couponCode: input.couponCode ?? decodedToken?.couponCode,
          referralCode: tokenRow?.referralCode,
          request,
        });

        return {
          success: true,
          message: result.alreadyCompleted
            ? "Payment verified and order placed successfully"
            : "Payment verified and order placed successfully",
          orderNumber: result.orderNumber,
          orderId: result.orderId,
        };
      })().finally(() => {
        inFlightVerifications.delete(input.razorpay_order_id);
      });

      inFlightVerifications.set(input.razorpay_order_id, verificationPromise);
      return verificationPromise;
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

    await ensureGatewayPaymentCaptured(input.razorpay_order_id, input.razorpay_payment_id);

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
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
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

    if (!signatureMatches(expectedSignature, signatureHeader)) {
      throw ApiError.badRequest("Invalid webhook signature");
    }

    // 2. Parse event payload safely
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw ApiError.badRequest("Invalid webhook JSON payload");
    }
    const eventType = String(event.event || "unknown");
    const payload = event.payload as
      | {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            status?: string;
            amount?: number | string;
            error_description?: string;
          };
        };
        order?: { entity?: { id?: string } };
      }
      | undefined;

    // We specifically handle payment captured or order paid events
    if (eventType === "order.paid" || eventType === "payment.captured") {
      const paymentEntity = payload?.payment?.entity;
      const gatewayOrderId = paymentEntity?.order_id || payload?.order?.entity?.id;
      const gatewayPaymentId = paymentEntity?.id;

      if (!gatewayOrderId) {
        await paymentRepository.recordWebhookAudit({
          eventType,
          payload: event as Prisma.InputJsonValue,
          status: "received",
        });
        return { received: true, ignored: "No gateway order id found in event" };
      }

      if (paymentEntity?.status && paymentEntity.status !== "captured") {
        await paymentRepository.recordWebhookAudit({
          eventType,
          payload: event as Prisma.InputJsonValue,
          status: "received",
        });
        return { received: true, ignored: `Payment status is ${paymentEntity.status}` };
      }

      // 1. Existing-order flow: local Payment record already exists
      const paymentRecord = await paymentRepository.findPaymentByGatewayOrderId(gatewayOrderId);
        if (paymentRecord) {
          if (paymentRecord.status === "success" && paymentRecord.order.payment_status === "paid") {
            return { received: true, duplicate: true };
          }

            const expectedPaise = Math.round(Number(paymentRecord.order.totalAmount) * 100);
            const webhookPaise =
              paymentEntity?.amount !== undefined ? Number(paymentEntity.amount) : expectedPaise;
            if(Number.isFinite(webhookPaise) && webhookPaise < expectedPaise) {
            await paymentRepository.recordWebhookAudit({
              eventType,
              payload: event as Prisma.InputJsonValue,
              status: "failed",
            });
            throw ApiError.badRequest("Webhook payment amount is less than order total");
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
          await paymentRepository.recordWebhookAudit({
            eventType,
            payload: event as Prisma.InputJsonValue,
            status: "processed",
          });

          return { received: true, processed: true };
        }

        // 2. Cart-first recovery: customer refreshed/closed browser before verify ran
        const tokenData = await paymentRepository.findTokenByRazorpayOrderId(gatewayOrderId);
        if (!tokenData) {
          await paymentRepository.recordWebhookAudit({
            eventType,
            payload: event as Prisma.InputJsonValue,
            status: "received",
          });
          return { received: true, ignored: "Payment record not found locally" };
        }

        if (!gatewayPaymentId) {
          await paymentRepository.recordWebhookAudit({
            eventType,
            payload: event as Prisma.InputJsonValue,
            status: "received",
          });
          return { received: true, ignored: "No gateway payment id found in event" };
        }

      const userRows = await db.$queryRaw<Array<{ uuid: string }>>`
      SELECT uuid FROM \`users\` WHERE id = ${tokenData.userId} LIMIT 1
    `;
      if (!userRows || userRows.length === 0) {
        return { received: true, ignored: "Customer user not found for checkout session" };
      }

        const decoded = decodeCheckoutNotes(tokenData.notes);
        const result = await finalizeCartCheckoutOrder({
          sessionUserId: userRows[0].uuid,
          userId: tokenData.userId,
          razorpayOrderId: gatewayOrderId,
          razorpayPaymentId: gatewayPaymentId,
          razorpaySignature: `webhook:${eventType}`,
          shippingAddressId: tokenData.shippingAddressId,
          billingAddressId: tokenData.billingAddressId || tokenData.shippingAddressId,
          deliveryMethod: decoded.deliveryMethod,
          notes: decoded.notes,
          couponCode: decoded.couponCode,
          referralCode: tokenData.referralCode,
        });

        await paymentRepository.recordWebhookAudit({
          eventType,
          payload: event as Prisma.InputJsonValue,
          status: "processed",
        });

        return {
          received: true,
          processed: !result.alreadyCompleted,
          duplicate: result.alreadyCompleted,
          orderNumber: result.orderNumber,
        };
      }

      if (eventType === "payment.failed") {
        const paymentEntity = payload?.payment?.entity;
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

        await paymentRepository.recordWebhookAudit({
          eventType,
          payload: event as Prisma.InputJsonValue,
          status: "processed",
        });

        return { received: true, processed: true };
      }

      await paymentRepository.recordWebhookAudit({
        eventType,
        payload: event as Prisma.InputJsonValue,
        status: "received",
      });

      return { received: true, unhandledEvent: eventType };
    },

  /**
   * Recover an in-flight checkout payment when a customer refreshes or loses
   * connection mid-payment after funds were already debited at Razorpay.
   */
  async recoverCheckoutPayment(
      sessionUserId: string,
      input: RecoverRazorpayPaymentInput,
      request ?: NextRequest
    ): Promise < {
      recovered: boolean;
      orderNumber?: string;
      orderId?: string;
      message?: string;
    } > {
      const user = await userRepository.findById(sessionUserId);
      if(!user || !user.internalId) {
      throw ApiError.unauthorized("User not found");
    }

    const userId = BigInt(user.internalId);
    const tokenData = await paymentRepository.findTokenByRazorpayOrderId(input.razorpayOrderId);
    if (tokenData && tokenData.userId !== userId) {
      throw ApiError.forbidden("Checkout session does not belong to this customer.");
    }

    // 1. If the webhook or an earlier verify call already created the order, return it immediately.
    const alreadyCommitted = await findCommittedOrderByGatewayOrderId(
      input.razorpayOrderId,
      userId
    );
    if (alreadyCommitted) {
      return {
        recovered: true,
        ...alreadyCommitted,
        message: "Order confirmed from your payment.",
      };
    }

    // 2. Ask Razorpay directly whether any payment for this order was authorized/captured.
    let paymentsResponse: { items?: RazorpayPaymentEntity[] };
    try {
      paymentsResponse = (await getRazorpayClient().orders.fetchPayments(
        input.razorpayOrderId
      )) as unknown as { items?: RazorpayPaymentEntity[] };
    } catch (err) {
      console.error("Razorpay orders.fetchPayments failed during recovery:", err);
      return { recovered: false };
    }

    const paidEntity = (paymentsResponse.items || []).find(
      (p) => p.status === "captured" || p.status === "authorized"
    );
    if (!paidEntity?.id) {
      return { recovered: false };
    }

    const shippingAddressId = tokenData?.shippingAddressId || input.shippingAddressId;
    if (!shippingAddressId) {
      return { recovered: false };
    }

    const decoded = tokenData ? decodeCheckoutNotes(tokenData.notes) : undefined;
    const finalized = await finalizeCartCheckoutOrder({
      sessionUserId,
      userId,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: paidEntity.id,
      razorpaySignature: "recovered:orders.fetchPayments",
      shippingAddressId,
      billingAddressId:
        input.billingAddressId || tokenData?.billingAddressId || shippingAddressId,
      deliveryMethod:
        (input.deliveryMethod as "standard" | "express") ||
        decoded?.deliveryMethod ||
        "standard",
      notes: input.notes ?? decoded?.notes,
      couponCode: input.couponCode ?? decoded?.couponCode,
      referralCode: tokenData?.referralCode,
      request,
    });

    return {
      recovered: true,
      orderNumber: finalized.orderNumber,
      orderId: finalized.orderId,
      message: "Your payment was verified and your order has been placed.",
    };
  },

  /**
   * The captured Razorpay payment behind an order, or null when nothing was
   * paid online (COD orders, or a gateway attempt that never succeeded).
   * Callers use it to choose between an automatic refund and a manual payout.
   */
  async findCapturedPayment(orderId: bigint) {
    return db.payment.findFirst({
      where: {
        orderId,
        status: "success",
        gateway: "RAZORPAY",
        is_active: true,
        gateway_payment_id: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Refunds part or all of a captured payment at the gateway and nothing more.
   * Unlike `refundPayment` this writes no rows: a partial return refund must
   * not flip the whole order to `refunded`, so the caller records the outcome
   * against its own refund row.
   */
  async createGatewayRefund(params: {
    gatewayPaymentId: string;
    amount: number;
    notes?: Record<string, string>;
  }) {
    const razorpay = getRazorpayClient();
    return razorpay.payments.refund(params.gatewayPaymentId, {
      amount: Math.round(params.amount * 100),
      ...(params.notes ? { notes: params.notes } : {}),
    });
  },

  /**
   * Refund an existing captured Razorpay payment
   */
  async refundPayment(params: {
    orderId: bigint;
    amount?: number;
    reason?: string;
  }) {
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

    const priorRefunds = await db.paymentTransaction.aggregate({
      where: {
        paymentId: successPayment.id,
        transaction_type: "refund",
        status: "refunded",
        is_active: true,
      },
      _sum: { amount: true },
    });
    const alreadyRefundedPaise = Math.round(Number(priorRefunds._sum.amount || 0) * 100);
    const totalPaidPaise = Math.round(Number(successPayment.amount) * 100);
    const remainingPaise = Math.max(0, totalPaidPaise - alreadyRefundedPaise);

    if (remainingPaise <= 0) {
      throw ApiError.badRequest("This payment has already been fully refunded.");
    }

    const refundAmountInPaise = params.amount
      ? Math.round(params.amount * 100)
      : remainingPaise;

if (refundAmountInPaise <= 0 || refundAmountInPaise > remainingPaise) {
  throw ApiError.badRequest(
    `Invalid refund amount. Remaining refundable amount is ₹${(remainingPaise / 100).toFixed(2)}.`
  );
}

const razorpay = getRazorpayClient();
const refund = await razorpay.payments.refund(successPayment.gateway_payment_id, {
  amount: refundAmountInPaise,
  notes: {
    orderId: String(params.orderId),
    reason: params.reason || "Order cancellation refund",
  },
});

const isFullRefund = alreadyRefundedPaise + refundAmountInPaise >= totalPaidPaise;

// Record refund transaction and update payment/order statuses accurately
await db.$transaction(async (tx) => {
  await tx.paymentTransaction.create({
    data: {
      paymentId: successPayment.id,
      transaction_type: "refund",
      amount: refundAmountInPaise / 100,
      status: "refunded",
      gatewayResponse: refund as unknown as Prisma.InputJsonValue,
      created_by: successPayment.created_by,
      updated_by: successPayment.updated_by,
    },
  });

  if (isFullRefund) {
    await tx.payment.update({
      where: { id: successPayment.id },
      data: { status: "refunded" },
    });
  }

  await tx.order.update({
    where: { id: params.orderId },
    data: {
      payment_status: isFullRefund ? "refunded" : "partial_refund",
    },
  });

  // If an initiated refund row exists (e.g. from cancelling a paid order), mark it completed
  const initiatedRefund = await tx.refunds.findFirst({
    where: {
      order_id: params.orderId,
      payment_id: successPayment.id,
      status: "initiated",
      is_active: true,
    },
    orderBy: { id: "asc" },
  });
  if (initiatedRefund) {
    await tx.refunds.update({
      where: { id: initiatedRefund.id },
      data: {
        status: "completed",
        transaction_ref: String(refund.id),
        processed_at: new Date(),
      },
    });
  }
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
  request ?: NextRequest
): Promise < { paymentUrl: string; token: string } > {
  const user = await userRepository.findById(sessionUserId);
  if(!user || !user.internalId) throw ApiError.unauthorized("User not found");
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
let rzpOrder: RazorpayOrderEntity;
try {
  rzpOrder = (await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: `REDIR_${Date.now().toString().slice(-8)}`,
    notes: {
      userId: String(userId),
      checkoutType: "redirect",
      shippingAddressId: input.shippingAddressId,
      deliveryMethod: input.deliveryMethod || "standard",
    },
  })) as unknown as RazorpayOrderEntity;
} catch (err: unknown) {
  const description = extractRazorpayErrorMessage(err, "Razorpay API error");
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
}): Promise < { orderNumber: string; orderId: string; success: boolean } > {
  // 1. Validate token
  const tokenData = await paymentRepository.findValidToken(input.token);
  if(!tokenData) {
    throw ApiError.badRequest("Payment token is invalid, expired, or already used.");
  }

    // 2. Cryptographic signature verification
          const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if(!secret) throw new Error("RAZORPAY_KEY_SECRET is not configured");

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
    .digest("hex");

  if(!signatureMatches(expectedSignature, input.razorpay_signature)) {
  throw ApiError.badRequest("Invalid payment signature. Verification rejected.");
}

// The signed Razorpay order must be the one this token was issued for;
// otherwise a cheap, genuinely-paid order could unlock a costlier cart.
if (input.razorpay_order_id !== tokenData.razorpayOrderId) {
  throw ApiError.badRequest("Payment does not match this checkout session.");
}

// Confirm with Razorpay that payment is captured (capturing if authorized) before burning the token.
const { chargedAmount } = await ensureGatewayPaymentCaptured(
  input.razorpay_order_id,
  input.razorpay_payment_id
);

// 3. Claim the token atomically (prevent replay / double submit)
if (!(await paymentRepository.markTokenUsed(input.token))) {
  const committedByWebhook = await findCommittedOrderByGatewayOrderId(input.razorpay_order_id);
  if (committedByWebhook) {
    return {
      success: true,
      ...committedByWebhook,
    };
  }
  throw ApiError.badRequest("Payment token is invalid, expired, or already used.");
}

// 4. Reconstruct sessionUserId from stored userId
const userRows = await db.$queryRaw<Array<{ uuid: string }>>`
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

// 5. Create internal order — only now, after verified payment. The money is
// already captured, so anything that stops the order here has to be paid
// back; the token stays used, since the charge it stood for is reversed.
let createdOrder;
try {
  createdOrder = await orderService.createCustomerOrder(
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
    { gatewayPaymentVerified: true, expectedPaidAmount: chargedAmount || tokenData.amount }
  );
} catch (orderErr: unknown) {
  const baseMsg =
    orderErr instanceof Error
      ? orderErr.message
      : "Could not complete your order after the payment went through.";
  const refunded = await refundCapturedPayment(
    input.razorpay_payment_id,
    input.razorpay_order_id,
    baseMsg
  );
  throw ApiError.badRequest(
    refunded
      ? `${baseMsg} A full refund has been automatically initiated to your payment method.`
      : `${baseMsg} We could not complete the refund automatically - please contact support with payment reference ${input.razorpay_payment_id}.`
  );
}

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


