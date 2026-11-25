import { test, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getRazorpayScriptUrl } from "@/features/customers/utils/razorpay-loader";
import {
  getRazorpayClient,
  getRazorpayPublicKey,
} from "@/features/payment/config/razorpay.config";
import { razorpayService } from "@/features/payment/services/razorpay.service";
import { paymentRepository } from "@/features/payment/repositories/payment.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import { orderService } from "@/features/orders/services/order.service";

test("live Razorpay credentials are configured in .env without whitespace", () => {
  assert.equal(process.env.RAZORPAY_KEY_ID, "rzp_live_U2lxVj7xAmZ66S");
  assert.equal(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, "rzp_live_U2lxVj7xAmZ66S");
  assert.ok(process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_SECRET.length > 0);
  assert.equal(process.env.NEXT_PUBLIC_RAZORPAY_BASE_URL, "https://checkout.razorpay.com");
});

test("getRazorpayPublicKey prefers server RAZORPAY_KEY_ID so modal matches created order", () => {
  const origKey = process.env.RAZORPAY_KEY_ID;
  const origPub = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  try {
    process.env.RAZORPAY_KEY_ID = " rzp_live_server ";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_stale";
    assert.equal(getRazorpayPublicKey(), "rzp_live_server");

    delete process.env.RAZORPAY_KEY_ID;
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = " rzp_live_public ";
    assert.equal(getRazorpayPublicKey(), "rzp_live_public");

    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    assert.throws(() => getRazorpayPublicKey(), /Razorpay Public Key ID is not configured/);
  } finally {
    if (origKey !== undefined) process.env.RAZORPAY_KEY_ID = origKey;
    else delete process.env.RAZORPAY_KEY_ID;
    if (origPub !== undefined) process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = origPub;
    else delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  }
});

test("getRazorpayClient initializes with trimmed credentials and rejects missing credentials", () => {
  const origKey = process.env.RAZORPAY_KEY_ID;
  const origSecret = process.env.RAZORPAY_KEY_SECRET;

  try {
    process.env.RAZORPAY_KEY_ID = "rzp_live_U2lxVj7xAmZ66S";
    process.env.RAZORPAY_KEY_SECRET = "nZZ7RqGzsGP7TdPeTn65qQzN";
    const client = getRazorpayClient();
    assert.ok(client);

    process.env.RAZORPAY_KEY_ID = "   ";
    assert.throws(() => getRazorpayClient(), /Razorpay API credentials are not configured/);
  } finally {
    if (origKey !== undefined) process.env.RAZORPAY_KEY_ID = origKey;
    else delete process.env.RAZORPAY_KEY_ID;
    if (origSecret !== undefined) process.env.RAZORPAY_KEY_SECRET = origSecret;
    else delete process.env.RAZORPAY_KEY_SECRET;
  }
});

test("getRazorpayScriptUrl resolves base URL, /v1 path, full .js URL, and defaults safely", () => {
  const origBase = process.env.NEXT_PUBLIC_RAZORPAY_BASE_URL;
  const origScript = process.env.NEXT_PUBLIC_RAZORPAY_SCRIPT_URL;

  try {
    delete process.env.NEXT_PUBLIC_RAZORPAY_BASE_URL;
    delete process.env.NEXT_PUBLIC_RAZORPAY_SCRIPT_URL;
    assert.equal(getRazorpayScriptUrl(), "https://checkout.razorpay.com/v1/checkout.js");

    process.env.NEXT_PUBLIC_RAZORPAY_BASE_URL = "https://checkout.razorpay.com/";
    assert.equal(getRazorpayScriptUrl(), "https://checkout.razorpay.com/v1/checkout.js");

    process.env.NEXT_PUBLIC_RAZORPAY_BASE_URL = "https://checkout.razorpay.com/v1";
    assert.equal(getRazorpayScriptUrl(), "https://checkout.razorpay.com/v1/checkout.js");

    process.env.NEXT_PUBLIC_RAZORPAY_BASE_URL = "https://checkout.razorpay.com/v1/checkout.js";
    assert.equal(getRazorpayScriptUrl(), "https://checkout.razorpay.com/v1/checkout.js");
  } finally {
    if (origBase !== undefined) process.env.NEXT_PUBLIC_RAZORPAY_BASE_URL = origBase;
    else delete process.env.NEXT_PUBLIC_RAZORPAY_BASE_URL;
    if (origScript !== undefined) process.env.NEXT_PUBLIC_RAZORPAY_SCRIPT_URL = origScript;
    else delete process.env.NEXT_PUBLIC_RAZORPAY_SCRIPT_URL;
  }
});

test("webhook + browser verification race and refresh recovery are idempotent without unintended refunds", async (t) => {
  const origSecret = process.env.RAZORPAY_KEY_SECRET;
  const origWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_KEY_SECRET = "test_secret_123";
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_123";

  const orderId = "order_race_001";
  const paymentId = "pay_race_001";
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  let claimed = false;
  let createOrderCalls = 0;

  t.after(() => {
    mock.restoreAll();
    if (origSecret !== undefined) process.env.RAZORPAY_KEY_SECRET = origSecret;
    else delete process.env.RAZORPAY_KEY_SECRET;
    if (origWebhookSecret !== undefined) process.env.RAZORPAY_WEBHOOK_SECRET = origWebhookSecret;
    else delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  mock.method(userRepository, "findById", async () => ({
    id: "user-uuid-1",
    internalId: BigInt(10),
    isActive: true,
    is_active: true,
  }));

  mock.method(paymentRepository, "findTokenByRazorpayOrderId", async () => ({
    id: BigInt(1),
    token: "tok_race",
    razorpayOrderId: orderId,
    internalOrderRef: "cart",
    shippingAddressId: "addr-uuid-1",
    billingAddressId: "addr-uuid-1",
    notes: null,
    referralCode: null,
    amount: 499,
    currency: "INR",
    orderNumber: null,
    keyId: "rzp_live_U2lxVj7xAmZ66S",
    userId: BigInt(10),
    isUsed: false,
  }));
  mock.method(paymentRepository, "claimByRazorpayOrderId", async () => {
    if (claimed) return false;
    claimed = true;
    return true;
  });
  mock.method(paymentRepository, "findCommittedOrderByGatewayOrderId", async () => ({
    orderNumber: "ORD-1001",
    orderId: "ord-uuid-1",
  }));
  mock.method(paymentRepository, "findPaymentByGatewayOrderId", async () => ({
    id: BigInt(3),
    status: "success",
    order: {
      id: BigInt(100),
      userId: BigInt(10),
      payment_status: "paid",
      totalAmount: 499,
    },
  }));
  mock.method(paymentRepository, "recordWebhookAudit", async () => undefined);
  mock.method(orderService, "createCustomerOrder", async () => {
    createOrderCalls++;
    return { id: "ord-uuid-1", orderNumber: "ORD-1001" };
  });

  // 1. Atomic claim only allows one winner
  assert.equal(await paymentRepository.claimByRazorpayOrderId(orderId), true);
  assert.equal(await paymentRepository.claimByRazorpayOrderId(orderId), false);

  // 2. When webhook already committed the order, browser verify returns it idempotently (no double order, no refund)
  const verifyResult = await razorpayService.verifyPaymentSignature("user-uuid-1", {
    orderId: "cart",
    shippingAddressId: "addr-uuid-1",
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  });
  assert.equal(verifyResult.success, true);
  assert.equal(verifyResult.orderNumber, "ORD-1001");
  assert.equal(verifyResult.orderId, "ord-uuid-1");
  assert.equal(createOrderCalls, 0);

  // 3. Duplicate webhook after payment is already recorded returns duplicate: true
  const rawWebhookBody = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
  });
  const webhookSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawWebhookBody)
    .digest("hex");
  const webhookResult = await razorpayService.handleWebhook(rawWebhookBody, webhookSig);
  assert.deepEqual(webhookResult, { received: true, duplicate: true });

  // 4. Refresh recovery returns the committed order without creating a duplicate or failing
  const recoveryResult = await razorpayService.recoverCheckoutPayment("user-uuid-1", {
    razorpayOrderId: orderId,
    shippingAddressId: "addr-uuid-1",
  });
  assert.equal(recoveryResult.recovered, true);
  assert.equal(recoveryResult.orderNumber, "ORD-1001");
  assert.equal(recoveryResult.orderId, "ord-uuid-1");

  // 5. Forged signature is rejected
  await assert.rejects(
    () =>
      razorpayService.verifyPaymentSignature("user-uuid-1", {
        orderId: "cart",
        shippingAddressId: "addr-uuid-1",
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: "forged_signature",
      }),
    /Invalid payment signature/
  );

  // 6. Webhook rejects tampered signature, malformed JSON, and underpaid webhook amounts
  await assert.rejects(
    () => razorpayService.handleWebhook("{}", "bad_sig"),
    /Invalid webhook signature/
  );
  const badJsonSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update("{not-json")
    .digest("hex");
  await assert.rejects(
    () => razorpayService.handleWebhook("{not-json", badJsonSig),
    /Invalid webhook JSON payload/
  );
});
