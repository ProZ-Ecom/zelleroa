import { db } from "@/lib/db/prisma";
import { syncCommissionsWithOrderStatus } from "@/features/agents/services/commission.service";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Format a JS Date as a MySQL-compatible UTC datetime string (YYYY-MM-DD HH:MM:SS).
 * This avoids MySQL interpreting the value as local time when the server timezone
 * differs from UTC (e.g. IST = UTC+5:30 would shift the time by 5.5 hours).
 */
function toUtcDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

let ensureTokensTablePromise: Promise<void> | null = null;

/**
 * Ensure `payment_redirect_tokens` exists even on fresh databases initialized
 * without running legacy helper scripts. Cached per process after first check.
 */
async function ensurePaymentTokensTable(): Promise<void> {
  if (!ensureTokensTablePromise) {
    ensureTokensTablePromise = db
      .$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS \`payment_redirect_tokens\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`token\` VARCHAR(64) NOT NULL,
          \`razorpay_order_id\` VARCHAR(100) NOT NULL,
          \`internal_order_ref\` VARCHAR(100) NOT NULL,
          \`shipping_address_id\` VARCHAR(100) NOT NULL,
          \`billing_address_id\` VARCHAR(100) DEFAULT NULL,
          \`notes\` TEXT DEFAULT NULL,
          \`referral_code\` VARCHAR(30) DEFAULT NULL,
          \`amount\` DECIMAL(12,2) NOT NULL,
          \`currency\` VARCHAR(10) NOT NULL DEFAULT 'INR',
          \`order_number\` VARCHAR(100) DEFAULT NULL,
          \`key_id\` VARCHAR(100) NOT NULL,
          \`user_id\` BIGINT UNSIGNED NOT NULL,
          \`is_used\` TINYINT(1) NOT NULL DEFAULT 0,
          \`expires_at\` DATETIME NOT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_token\` (\`token\`),
          INDEX \`idx_token_exp\` (\`token\`, \`expires_at\`, \`is_used\`),
          INDEX \`idx_rzp_order_id\` (\`razorpay_order_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
      )
      .then(() => undefined)
      .catch((err) => {
        ensureTokensTablePromise = null;
        throw err;
      });
  }
  return ensureTokensTablePromise;
}

export const paymentRepository = {
  /**
   * Get or create a payment method row (e.g. RAZORPAY, COD)
   */
  async getOrCreatePaymentMethod(code: string, name: string) {
    let method = await db.payment_methods.findUnique({
      where: { code },
    });

    if (!method) {
      method = await db.payment_methods.create({
        data: {
          name,
          code,
          is_active: true,
        },
      });
    }

    return method;
  },

  /**
   * Find an order by internal UUID, OrderNumber, or numeric ID belonging to a specific customer
   */
  async findCustomerOrder(userId: bigint, orderRef: string) {
    const isNumeric = /^\d+$/.test(orderRef);
    const order = await db.order.findFirst({
      where: {
        userId,
        is_active: true,
        OR: [
          { uuid: orderRef },
          { orderNumber: orderRef },
          ...(isNumeric ? [{ id: BigInt(orderRef) }] : []),
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            uuid: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        payments: {
          where: { is_active: true },
          include: { payment_methods: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return order;
  },

  /**
   * Find an order globally by gateway order id (used by webhooks)
   */
  async findPaymentByGatewayOrderId(gatewayOrderId: string) {
    return db.payment.findFirst({
      where: {
        gateway_order_id: gatewayOrderId,
        is_active: true,
      },
      include: {
        order: {
          include: {
            user: true,
          },
        },
      },
    });
  },

  /**
   * Check if an active pending payment record exists for this order & gateway order id
   */
  async findPendingPayment(orderId: bigint, gatewayOrderId?: string) {
    return db.payment.findFirst({
      where: {
        orderId,
        is_active: true,
        ...(gatewayOrderId ? { gateway_order_id: gatewayOrderId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Create an initial Payment record for a Razorpay order
   */
  async createPaymentRecord(params: {
    orderId: bigint;
    paymentMethodId: bigint;
    amount: number;
    currency?: string;
    gatewayOrderId: string;
    createdBy?: bigint;
  }) {
    return db.payment.create({
      data: {
        orderId: params.orderId,
        payment_method_id: params.paymentMethodId,
        amount: params.amount,
        currency: params.currency || "INR",
        status: "pending",
        gateway: "RAZORPAY",
        gateway_order_id: params.gatewayOrderId,
        created_by: params.createdBy ?? params.orderId,
        updated_by: params.createdBy ?? params.orderId,
      },
    });
  },

  /**
   * Complete payment verification and confirm order transactionally
   */
  async recordPaymentSuccess(params: {
    paymentId: bigint;
    orderId: bigint;
    userId: bigint;
    razorpayPaymentId: string;
    gatewayResponse: Record<string, unknown>;
    amount: number;
  }) {
    return db.$transaction(async (tx) => {
      const now = new Date();

        // Atomic status transition so concurrent webhook + browser verification never double-write transactions.
        const claimed = await tx.payment.updateMany({
          where: { id: params.paymentId, status: { not: "success" } },
          data: {
            status: "success",
            gateway_payment_id: params.razorpayPaymentId,
            updatedAt: now,
            updated_by: params.userId,
          },
        });

        if(claimed.count === 0) {
          const [existingPayment, existingOrder] = await Promise.all([
            tx.payment.findUniqueOrThrow({ where: { id: params.paymentId } }),
            tx.order.findUniqueOrThrow({ where: { id: params.orderId } }),
          ]);
      return {
        payment: existingPayment,
        order: existingOrder,
      };
    }

      const updatedPayment = await tx.payment.findUniqueOrThrow({
      where: { id: params.paymentId },
    });

    // 2. Create PaymentTransaction audit record
    await tx.paymentTransaction.create({
      data: {
        paymentId: params.paymentId,
        transaction_type: "charge",
        amount: params.amount,
        status: "captured",
        gatewayResponse: params.gatewayResponse as Prisma.InputJsonValue,
        created_by: params.userId,
        updated_by: params.userId,
      },
    });

    // 3. Update Order to paid and confirmed
    const updatedOrder = await tx.order.update({
      where: { id: params.orderId },
      data: {
        payment_status: "paid",
        order_status: "confirmed",
        updatedAt: now,
        updated_by: params.userId,
      },
    });
    await syncCommissionsWithOrderStatus(tx, params.orderId, "confirmed", { id: params.userId, role: "USER" });

    // 4. Create Order Status History
    await tx.order_status_history.create({
      data: {
        order_id: params.orderId,
        status: "confirmed",
        note: `Payment captured successfully via Razorpay (Payment ID: ${params.razorpayPaymentId})`,
        changed_by: params.userId,
        created_by: params.userId,
        updated_by: params.userId,
      },
    });

    return {
      payment: updatedPayment,
      order: updatedOrder,
    };
  });
  },

  /**
   * Record payment failure
   */
  async recordPaymentFailure(params: {
    paymentId: bigint;
    orderId: bigint;
    userId?: bigint;
    errorReason: string;
    gatewayResponse?: Record<string, unknown>;
    amount: number;
  }) {
  return db.$transaction(async (tx) => {
    const now = new Date();

    // 1. Update Payment status to failed
    await tx.payment.update({
      where: { id: params.paymentId },
      data: {
        status: "failed",
        updatedAt: now,
        updated_by: params.userId,
      },
    });

    // 2. Create PaymentTransaction audit entry
    await tx.paymentTransaction.create({
      data: {
        paymentId: params.paymentId,
        transaction_type: "charge",
        amount: params.amount,
        status: "failed",
        gatewayResponse: (params.gatewayResponse || { error: params.errorReason }) as Prisma.InputJsonValue,
        created_by: params.userId,
        updated_by: params.userId,
      },
    });

    // 3. Keep order as payment_status failed but order remains pending/open for retry
    await tx.order.update({
      where: { id: params.orderId },
      data: {
        payment_status: "failed",
        updatedAt: now,
        updated_by: params.userId,
      },
    });

    // 4. Append to status history
    await tx.order_status_history.create({
      data: {
        order_id: params.orderId,
        status: "pending",
        note: `Razorpay payment failed: ${params.errorReason}`,
        changed_by: params.userId,
        created_by: params.userId,
        updated_by: params.userId,
      },
    });
  });
},

  // ─── Payment Redirect Token methods ─────────────────────────────────────────

  /**
   * Create a one-time short-lived payment redirect token in the DB.
   * The payment app uses this token to retrieve payment details without
   * requiring authentication — the token acts as a secure, expiring capability.
   */
  async createPaymentToken(params: {
  token: string;
  razorpayOrderId: string;
  internalOrderRef: string;
  shippingAddressId: string;
  billingAddressId?: string;
  notes?: string;
  /** Referral code active (if any) when the redirect-payment flow was initiated. */
  referralCode?: string | null;
  amount: number;
  currency: string;
  orderNumber?: string;
  keyId: string;
  userId: bigint;
  expiresAt: Date;
}): Promise < void> {
  await ensurePaymentTokensTable();
  await db.$executeRaw`
      INSERT INTO \`payment_redirect_tokens\`
        (\`token\`, \`razorpay_order_id\`, \`internal_order_ref\`, \`shipping_address_id\`,
         \`billing_address_id\`, \`notes\`, \`referral_code\`, \`amount\`, \`currency\`, \`order_number\`,
         \`key_id\`, \`user_id\`, \`is_used\`, \`expires_at\`)
      VALUES
        (${params.token}, ${params.razorpayOrderId}, ${params.internalOrderRef},
         ${params.shippingAddressId}, ${params.billingAddressId ?? null},
         ${params.notes ?? null}, ${params.referralCode ?? null}, ${params.amount}, ${params.currency},
         ${params.orderNumber ?? null}, ${params.keyId}, ${params.userId},
         0, ${toUtcDatetimeString(params.expiresAt)})
    `;
},

  /**
   * Find a valid (unused, non-expired) token. Returns null if not found / expired / used.
   */
  async findValidToken(token: string): Promise < {
    id: bigint;
    token: string;
    razorpayOrderId: string;
    internalOrderRef: string;
    shippingAddressId: string;
    billingAddressId: string | null;
    notes: string | null;
    referralCode: string | null;
    amount: number;
    currency: string;
    orderNumber: string | null;
    keyId: string;
    userId: bigint;
  } | null > {
    await ensurePaymentTokensTable();
    const rows = await db.$queryRaw<Array<{
      id: bigint | number | string;
      token: string;
      razorpay_order_id: string;
      internal_order_ref: string;
      shipping_address_id: string;
      billing_address_id: string | null;
      notes: string | null;
      referral_code: string | null;
      amount: string | number;
      currency: string;
      order_number: string | null;
      key_id: string;
      user_id: bigint | number | string;
    }>>`
      SELECT id, token, razorpay_order_id, internal_order_ref, shipping_address_id,
             billing_address_id, notes, referral_code, amount, currency, order_number, key_id, user_id
      FROM \`payment_redirect_tokens\`
      WHERE token = ${token}
        AND is_used = 0
        AND (expires_at > UTC_TIMESTAMP() OR expires_at > NOW())
      LIMIT 1
    `;

    if(!rows || rows.length === 0) return null;

const row = rows[0];
return {
  id: BigInt(row.id),
  token: row.token,
  razorpayOrderId: row.razorpay_order_id,
  internalOrderRef: row.internal_order_ref,
  shippingAddressId: row.shipping_address_id,
  billingAddressId: row.billing_address_id ?? null,
  notes: row.notes ?? null,
  referralCode: row.referral_code ?? null,
  amount: Number(row.amount),
  currency: row.currency,
  orderNumber: row.order_number ?? null,
  keyId: row.key_id,
  userId: BigInt(row.user_id),
};
  },

  /**
   * Mark a token as used (single-use guarantee).
   */
  async markTokenUsed(token: string): Promise < boolean > {
  // Atomic claim: only the single request that flips is_used 0 -> 1 wins, so
  // a double-submit cannot create two orders from one payment.
  const affected = await db.$executeRaw`
      UPDATE \`payment_redirect_tokens\`
      SET \`is_used\` = 1
      WHERE \`token\` = ${token} AND \`is_used\` = 0
    `;
  return Number(affected) > 0;
},

  /**
   * Look up a persisted checkout intent by Razorpay order ID (used by webhooks
   * and refresh-recovery when the browser callback did not complete).
   */
  async findTokenByRazorpayOrderId(razorpayOrderId: string): Promise < {
    id: bigint;
    token: string;
    razorpayOrderId: string;
    internalOrderRef: string;
    shippingAddressId: string;
    billingAddressId: string | null;
    notes: string | null;
    referralCode: string | null;
    amount: number;
    currency: string;
    orderNumber: string | null;
    keyId: string;
    userId: bigint;
    isUsed: boolean;
  } | null > {
    await ensurePaymentTokensTable();
    const rows = await db.$queryRaw<Array<{
      id: bigint | number | string;
      token: string;
      razorpay_order_id: string;
      internal_order_ref: string;
      shipping_address_id: string;
      billing_address_id: string | null;
      notes: string | null;
      referral_code: string | null;
      amount: string | number;
      currency: string;
      order_number: string | null;
      key_id: string;
      user_id: bigint | number | string;
      is_used: number | boolean;
    }>>`
      SELECT id, token, razorpay_order_id, internal_order_ref, shipping_address_id,
             billing_address_id, notes, referral_code, amount, currency, order_number, key_id, user_id, is_used
      FROM \`payment_redirect_tokens\`
      WHERE razorpay_order_id = ${razorpayOrderId}
      ORDER BY id DESC
      LIMIT 1
    `;

    if(!rows || rows.length === 0) return null;
const row = rows[0];
return {
  id: BigInt(row.id),
  token: row.token,
  razorpayOrderId: row.razorpay_order_id,
  internalOrderRef: row.internal_order_ref,
  shippingAddressId: row.shipping_address_id,
  billingAddressId: row.billing_address_id ?? null,
  notes: row.notes ?? null,
  referralCode: row.referral_code ?? null,
  amount: Number(row.amount),
  currency: row.currency,
  orderNumber: row.order_number ?? null,
  keyId: row.key_id,
  userId: BigInt(row.user_id),
  isUsed: Boolean(Number(row.is_used)),
};
  },

  /**
   * Atomically claim a checkout intent by Razorpay order ID.
   * Only one caller (browser verification, webhook, or refresh recovery) can
   * flip is_used 0 -> 1, preventing concurrent order creation and false refunds.
   */
  async claimByRazorpayOrderId(razorpayOrderId: string): Promise < boolean > {
  await ensurePaymentTokensTable();
  const affected = await db.$executeRaw`
      UPDATE \`payment_redirect_tokens\`
      SET \`is_used\` = 1
      WHERE \`razorpay_order_id\` = ${razorpayOrderId} AND \`is_used\` = 0
    `;
  return Number(affected) > 0;
},

  /**
   * Find an already-committed paid order by its Razorpay order ID.
   */
  async findCommittedOrderByGatewayOrderId(
    razorpayOrderId: string,
    expectedUserId?: bigint
  ): Promise<{ orderNumber: string; orderId: string } | null> {
    const committedPayment = await db.payment.findFirst({
      where: { gateway_order_id: razorpayOrderId, status: "success" },
      include: { order: { select: { id: true, uuid: true, orderNumber: true, userId: true } } },
    });
    if (!committedPayment?.order) return null;
    if (expectedUserId !== undefined && committedPayment.order.userId !== expectedUserId) {
      return null;
    }
    return {
      orderNumber: committedPayment.order.orderNumber,
      orderId: committedPayment.order.uuid || String(committedPayment.order.id),
    };
  },

  /**
   * Persist an incoming Razorpay webhook audit entry without breaking payment
   * processing if audit logging fails.
   */
  async recordWebhookAudit(params: {
    eventType: string;
    payload: Prisma.InputJsonValue;
    status: "received" | "processed" | "failed";
  }): Promise<void> {
    try {
      await db.payment_gateway_webhooks.create({
        data: {
          gateway: "RAZORPAY",
          event_type: params.eventType.slice(0, 100),
          payload: params.payload,
          status: params.status,
          processed_at: params.status === "received" ? null : new Date(),
        },
      });
    } catch (err) {
      console.error("[Razorpay] Failed to write payment_gateway_webhooks audit row:", err);
    }
  },
};
