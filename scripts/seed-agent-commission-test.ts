/**
 * TEST-DATA ONLY. Creates a backdated agent-attributed order that is already
 * delivered, so the commission it raises is past its return window and can be
 * approved / paid out without waiting real days.
 *
 * The commission rows themselves are created by the real production path
 * (`createCommissionsForOrder`), so percentage, rate source, rounding and the
 * audit trail are exactly what a live order produces. Only the timestamps are
 * backdated afterwards - no API lets you set them.
 *
 *   npm run db:seed:commission-test
 *   npm run db:seed:commission-test -- --days=5 --qty=2
 *   npm run db:seed:commission-test -- --agent=ZEL-BNTYWX --customer=361 --sku=STRAPWATCH-WHITE
 *   npm run db:seed:commission-test -- --approve
 *   npm run db:seed:commission-test -- --cleanup
 *
 * Flags
 *   --days=N      how many days ago the order was placed AND delivered (default 3)
 *   --qty=N       quantity on the single line (default 1)
 *   --agent=X     agent id, email, uuid or referral code (default: first active AGENT)
 *   --customer=X  customer id or email (default: a customer assigned to that agent)
 *   --sku=X       variant_unit_prices.sku or id (default: an SKU that has a commission rate)
 *   --approve     also run the real approval sweep + admin approve after creating
 *   --cleanup     delete every order/commission this script created, and stop
 */
import "dotenv/config";
import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import {
  createCommissionsForOrder,
  getReturnPeriodDays,
  commissionService,
} from "@/features/agents/services/commission.service";
import { resolveCommissionRate } from "@/features/agents/services/commission-rate.service";
import { recordStockMovement } from "@/features/inventory/services/stock-ledger.service";

const MARKER = "[commission-test]";
const DAY_MS = 24 * 60 * 60 * 1000;

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  return eq === -1 ? "true" : hit.slice(eq + 1);
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const money = (n: number) => `Rs.${n.toFixed(2)}`;

async function cleanup() {
  const orders = await db.order.findMany({
    where: { notes: { startsWith: MARKER } },
    select: {
      id: true,
      orderNumber: true,
      items: { select: { variantUnitPriceId: true, quantity: true, sku_snapshot: true } },
    },
  });
  if (orders.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }
  const ids = orders.map((o) => o.id);
  const commissionIds = (
    await db.commissions.findMany({ where: { order_id: { in: ids } }, select: { id: true } })
  ).map((c) => c.id);

  await db.$transaction(async (tx) => {
    // Give the stock back through the ledger (the only sanctioned way to move
    // quantity_available), so the SALE row and this RETURN row both stay as trail.
    for (const order of orders) {
      for (const item of order.items) {
        if (!item.variantUnitPriceId) continue;
        await recordStockMovement(tx, {
          variantUnitPriceId: item.variantUnitPriceId,
          movementType: "RETURN",
          direction: "in",
          quantity: item.quantity,
          referenceType: "order",
          referenceNumber: order.orderNumber,
          reason: `${MARKER} cleanup - seeded order removed`,
          itemLabel: item.sku_snapshot,
        });
      }
    }
    if (commissionIds.length > 0) {
      await tx.commission_audit_logs.deleteMany({
        where: { entity_type: "commission", entity_id: { in: commissionIds } },
      });
      await tx.commissions.deleteMany({ where: { id: { in: commissionIds } } });
    }
    // The order rows go, so drop the FK-free reference these ledger rows hold.
    await tx.inventoryTransaction.updateMany({
      where: { referenceType: "order", referenceId: { in: ids } },
      data: { referenceId: null },
    });
    await tx.order_status_history.deleteMany({ where: { order_id: { in: ids } } });
    await tx.orderAddress.deleteMany({ where: { orderId: { in: ids } } });
    await tx.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await tx.order.deleteMany({ where: { id: { in: ids } } });
  });
  console.log(
    `Removed ${orders.length} test order(s) and ${commissionIds.length} commission(s), stock restored: ` +
      orders.map((o) => o.orderNumber).join(", ")
  );
}

const skuSelect = {
  id: true,
  sku: true,
  base_price: true,
  variant_id: true,
  variant: {
    select: {
      variant_name: true,
      itemId: true,
      item: {
        select: {
          name: true,
          styleId: true,
          style: {
            select: { product: { select: { id: true, name: true, categoryId: true } } },
          },
        },
      },
    },
  },
} as const;

async function main() {
  if (arg("cleanup")) {
    await cleanup();
    return;
  }

  const daysAgo = Math.max(0, num(arg("days"), 3));
  const qty = Math.max(1, Math.round(num(arg("qty"), 1)));

  // ---- 1. Agent -----------------------------------------------------------
  const agentKey = arg("agent");
  const agent = agentKey
    ? await db.user.findFirst({
        where: {
          role: { name: "AGENT" },
          OR: [
            ...(/^\d+$/.test(agentKey) ? [{ id: BigInt(agentKey) }] : []),
            { email: agentKey },
            { referral_code: agentKey },
            { uuid: agentKey },
          ],
        },
      })
    : await db.user.findFirst({
        where: { role: { name: "AGENT" }, is_active: true, deleted_at: null },
        orderBy: { id: "asc" },
      });
  if (!agent) throw new Error(`No AGENT found${agentKey ? ` for "${agentKey}"` : ""}.`);

  // ---- 2. Customer --------------------------------------------------------
  const customerKey = arg("customer");
  const customer = customerKey
    ? await db.user.findFirst({
        where: {
          OR: [
            ...(/^\d+$/.test(customerKey) ? [{ id: BigInt(customerKey) }] : []),
            { email: customerKey },
          ],
        },
      })
    : ((await db.user.findFirst({
        where: { role: { name: "CUSTOMER" }, is_active: true, current_agent_id: agent.id },
        orderBy: { id: "asc" },
      })) ??
      (await db.user.findFirst({
        where: { role: { name: "CUSTOMER" }, is_active: true },
        orderBy: { id: "asc" },
      })));
  if (!customer) throw new Error("No CUSTOMER found.");
  if (customer.id === agent.id) {
    throw new Error("Customer and agent are the same user - pass --customer explicitly.");
  }

  // ---- 3. SKU (prefer one that actually has a commission rate) ------------
  const skuKey = arg("sku");
  let sku = skuKey
    ? await db.variantUnitPrice.findFirst({
        where: { OR: [...(/^\d+$/.test(skuKey) ? [{ id: BigInt(skuKey) }] : []), { sku: skuKey }] },
        select: skuSelect,
      })
    : null;

  if (!sku) {
    const candidates = (
      await db.variantUnitPrice.findMany({
        // style_id = 0 items are orphans left by an older migration: they have
        // no style row, so `style` comes back null and there is no product.
        where: {
          isActive: true,
          deleted_at: null,
          variant: { isActive: true, deleted_at: null, item: { styleId: { not: 0 } } },
        },
        select: skuSelect,
        orderBy: { id: "asc" },
        take: 300,
      })
    ).filter((c) => c.variant?.item?.style?.product != null);

    for (const candidate of candidates) {
      const p = candidate.variant.item.style.product;
      const r = await resolveCommissionRate(
        db,
        p.id,
        p.categoryId != null ? BigInt(p.categoryId) : null
      );
      if (r.percentage > 0) {
        sku = candidate;
        break;
      }
    }
    sku ??= candidates[0] ?? null;
  }
  if (!sku) throw new Error("No active SKU found.");
  if (!sku.variant?.item?.style?.product) {
    throw new Error(`SKU ${sku.sku} has no style/product (orphaned row) - pass a different --sku.`);
  }

  const product = sku.variant.item.style.product;
  const categoryId = product.categoryId != null ? BigInt(product.categoryId) : null;
  const rate = await resolveCommissionRate(db, product.id, categoryId);
  if (rate.percentage <= 0) {
    console.warn(
      `!! No commission rate applies to "${product.name}" (source: ${rate.source}). The order ` +
        `will be created but NO commission row - set a rate in Admin > Commission Rates first.`
    );
  }

  // ---- 4. Timestamps ------------------------------------------------------
  const returnPeriodDays = await getReturnPeriodDays();
  const now = new Date();
  // One extra hour, so "delivered exactly N days ago" is unambiguously past the window.
  const placedAt = new Date(now.getTime() - daysAgo * DAY_MS - 60 * 60 * 1000);
  const deliveredAt = new Date(placedAt.getTime() + 30 * 60 * 1000);
  const returnEndsAt = new Date(deliveredAt.getTime() + returnPeriodDays * DAY_MS);

  const unitPrice = Number(sku.base_price);
  const lineTotal = Math.round(unitPrice * qty * 100) / 100;
  const orderNumber = `ORD-${placedAt.toISOString().slice(0, 10).replace(/-/g, "")}-T${Date.now()
    .toString()
    .slice(-6)}`;

  // ---- 5. Create ----------------------------------------------------------
  const created = await db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        uuid: crypto.randomUUID(),
        orderNumber,
        userId: customer.id,
        order_status: "delivered",
        payment_status: "paid",
        subtotal: lineTotal,
        discountAmount: 0,
        taxAmount: 0,
        shipping_charge: 0,
        totalAmount: lineTotal,
        notes: `${MARKER} backdated ${daysAgo}d test order`,
        placed_at: placedAt,
        createdAt: placedAt,
        updatedAt: deliveredAt,
        delivered_at: deliveredAt,
        agent_id: agent.id,
        ordered_by_id: agent.id,
        order_source: "AGENT_PLACED_FOR_CUSTOMER",
        referral_code: agent.referral_code,
        is_active: true,
        created_by: agent.id,
        updated_by: agent.id,
      },
    });

    const addr = {
      full_name: customer.name,
      phone: customer.phone ?? "9000000000",
      address_line1: "1 Test Street",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600001",
      country: "India",
      is_active: true,
      created_by: agent.id,
      updated_by: agent.id,
      createdAt: placedAt,
      updated_at: placedAt,
    };
    await tx.orderAddress.createMany({
      data: [
        { uuid: crypto.randomUUID(), orderId: order.id, type: "shipping", ...addr },
        { uuid: crypto.randomUUID(), orderId: order.id, type: "billing", ...addr },
      ],
    });

    await tx.orderItem.create({
      data: {
        uuid: crypto.randomUUID(),
        orderId: order.id,
        productId: product.id,
        styleId: sku.variant.item.styleId,
        itemId: sku.variant.itemId,
        variantId: sku.variant_id,
        variantUnitPriceId: sku.id,
        product_name_snapshot: product.name,
        item_name_snapshot: sku.variant.item.name,
        variant_snapshot: sku.variant.variant_name,
        attributes_snapshot: [],
        sku_snapshot: sku.sku,
        quantity: qty,
        unit_price: unitPrice,
        discount_amount: 0,
        tax_amount: 0,
        total_price: lineTotal,
        is_active: true,
        created_by: agent.id,
        updated_by: agent.id,
        createdAt: placedAt,
        updated_at: placedAt,
      },
    });

    // Real production path: freezes percentage + amount, writes the audit row
    // and updates the order's blended commission summary.
    const commissionIds = await createCommissionsForOrder(tx, order.id);

    // Backdate the delivery clock the way `syncCommissionsWithOrderStatus`
    // would have, but with our timestamps instead of now().
    if (commissionIds.length > 0) {
      await tx.commissions.updateMany({
        where: { id: { in: commissionIds } },
        data: {
          order_status: "delivered",
          delivered_at: deliveredAt,
          return_period_ends_at: returnEndsAt,
          created_at: placedAt,
        },
      });
    }

    const flow = ["pending", "confirmed", "shipped", "delivered"] as const;
    for (let i = 0; i < flow.length; i += 1) {
      const at = new Date(placedAt.getTime() + i * 10 * 60 * 1000);
      await tx.order_status_history.create({
        data: {
          order_id: order.id,
          status: flow[i],
          note: `${MARKER} seeded`,
          changed_by: agent.id,
          created_at: at,
          updated_at: at,
          is_active: true,
          created_by: agent.id,
          updated_by: agent.id,
        },
      });
    }

    await recordStockMovement(tx, {
      variantUnitPriceId: sku.id,
      movementType: "SALE",
      direction: "out",
      quantity: qty,
      referenceType: "order",
      referenceId: order.id,
      referenceNumber: order.orderNumber,
      reason: `${MARKER} seeded order`,
      actorId: agent.id,
      itemLabel: sku.sku,
    });

    return { order, commissionIds };
  });

  const rows = await db.commissions.findMany({
    where: { order_id: created.order.id },
    select: {
      uuid: true,
      status: true,
      product_amount: true,
      commission_percentage: true,
      rate_source: true,
      commission_amount: true,
    },
  });

  console.log("");
  console.log(`Order        ${created.order.orderNumber}  (id ${created.order.id})`);
  console.log(`Agent        ${agent.name} (id ${agent.id}, ${agent.referral_code ?? "no code"})`);
  console.log(`Customer     ${customer.name} (id ${customer.id})`);
  console.log(`Line         ${sku.sku} x${qty} @ ${money(unitPrice)} = ${money(lineTotal)}`);
  console.log(`Placed       ${placedAt.toISOString()}`);
  console.log(`Delivered    ${deliveredAt.toISOString()}`);
  console.log(`Return ends  ${returnEndsAt.toISOString()}  (period: ${returnPeriodDays} day(s))`);
  console.log(
    `Window over  ${returnEndsAt <= now ? "YES - approvable now" : "NO - still inside the window"}`
  );
  console.log("");
  if (rows.length === 0) {
    console.log("Commission   none (no rate applied)");
  }
  for (const r of rows) {
    console.log(
      `Commission   ${r.status.padEnd(16)} ${money(Number(r.product_amount))} x ` +
        `${Number(r.commission_percentage)}% (${r.rate_source}) = ` +
        `${money(Number(r.commission_amount))}   ${r.uuid}`
    );
  }

  if (!arg("approve")) {
    console.log("\nNext: open the agent Commissions page (the sweep runs on read), or re-run with --approve.");
    return;
  }

  const ready = await commissionService.markReadyForApproval();
  console.log(`\nmarkReadyForApproval -> ${ready} row(s) moved to pending_approval`);
  const adminRole = await db.role.findFirst({ where: { name: "ADMIN" }, select: { id: true } });
  const admin = adminRole
    ? await db.user.findFirst({
        where: { roleId: adminRole.id, is_active: true },
        orderBy: { id: "asc" },
      })
    : null;
  if (!admin) {
    console.log("No ADMIN user found - approve from the admin UI instead.");
  } else {
    const approved = await commissionService.approve({
      ids: rows.map((r) => r.uuid),
      actor: { id: admin.id, role: "ADMIN" },
    });
    console.log(`approve -> ${approved} row(s) now 'approved' (actor: ${admin.name})`);
  }
  const after = await db.commissions.findMany({
    where: { order_id: created.order.id },
    select: { uuid: true, status: true },
  });
  for (const a of after) console.log(`  ${a.uuid} -> ${a.status}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
