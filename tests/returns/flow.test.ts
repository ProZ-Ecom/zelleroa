import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableActions,
  getShipWindow,
  isShippingSlipUrl,
  RETURN_FLOW,
  RETURN_SHIP_WINDOW_DAYS,
  RETURN_TRANSITIONS,
  returnPendingHint,
  returnStatusLabel,
  returnStatusMessage,
  SHIPPING_SLIP_URL_PREFIX,
  type ReturnAction,
} from "@/features/returns/lib/policy";
import { customerReturnActionSchema } from "@/features/returns/validations/return.schema";
import { slipService } from "@/features/returns/services/slip.service";
import {
  buildReturnSteps,
  consumedOrderItemIds,
  isRequestConsuming,
} from "@/features/returns/lib/summary";
import type { RequestSummary } from "@/features/returns/lib/summary";

const APPROVED_ON = new Date("2026-11-03T06:00:00.000Z"); // 2026-11-03 11:30 IST

function request(over: Partial<RequestSummary> = {}): RequestSummary {
  return {
    id: "req-1",
    returnNumber: "RET-20261103-ABC123",
    kind: "return",
    status: "return_requested",
    reason: "Damaged product",
    description: null,
    unboxingVideoUrl: null,
    requestedAt: new Date("2026-11-01T06:00:00.000Z"),
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    adminComment: null,
    pickupScheduledAt: null,
    completedAt: null,
    items: [],
    history: [],
    ...over,
  };
}

// ── Status copy ────────────────────────────────────────────────────────────

test("each status renders the agreed customer sentence", () => {
  assert.equal(
    returnStatusMessage("return_requested", { reason: "Wrong size" }),
    "Return request raised. Reason: Wrong size"
  );
  assert.equal(
    returnStatusMessage("under_review"),
    "Your return request is being reviewed. This usually takes 24–48 hours."
  );
  assert.equal(
    returnStatusMessage("approved", { deadline: new Date("2026-11-05T12:00:00.000Z") }),
    "Return approved. Please ship the item to our address before 05 Nov 2026."
  );
  assert.equal(
    returnStatusMessage("shipped_by_customer", { courier: "Delhivery", trackingNo: "AWB999" }),
    "Item shipped via Delhivery. Tracking no: AWB999"
  );
  assert.equal(
    returnStatusMessage("received"),
    "Returned item received. Quality check in progress."
  );
  assert.equal(
    returnStatusMessage("refund_pending", { amount: 1499 }),
    "Quality check passed. Refund of ₹1,499.00 will be credited within 5–7 working days."
  );
  assert.equal(
    returnStatusMessage("refunded", {
      amount: 1499,
      refundMode: "your bank account ••••4321",
      refNo: "rfnd_123",
    }),
    "₹1,499.00 refunded to your bank account ••••4321. Ref no: rfnd_123"
  );
});

test("exception statuses render their own sentence and label", () => {
  assert.equal(returnStatusLabel("rejected"), "Return Rejected");
  assert.equal(returnStatusLabel("expired"), "Return Expired");
  assert.equal(returnStatusLabel("qc_failed"), "QC Failed");
  assert.equal(returnStatusLabel("cancelled"), "Return Cancelled");

  assert.equal(
    returnStatusMessage("rejected", { reason: "Unboxing video unclear" }),
    "Return request rejected. Reason: Unboxing video unclear"
  );
  assert.equal(
    returnStatusMessage("expired", { deadline: new Date("2026-11-05T12:00:00.000Z") }),
    "Return closed as the item was not shipped before 05 Nov 2026."
  );
  assert.equal(
    returnStatusMessage("qc_failed", { reason: "Item used" }),
    "Returned item did not pass quality check. Reason: Item used"
  );
  assert.equal(
    returnStatusMessage("cancelled"),
    "Return request cancelled by customer."
  );
});

test("pending hints exist for every step the customer waits on", () => {
  assert.equal(returnPendingHint("under_review"), "We’ll update you once reviewed");
  assert.equal(returnPendingHint("approved"), "Awaiting approval");
  assert.equal(returnPendingHint("shipped_by_customer"), "Add tracking details after shipping");
  assert.equal(returnPendingHint("received"), "Awaiting item at our warehouse");
  assert.equal(returnPendingHint("refund_pending"), "After quality check");
  assert.equal(returnPendingHint("refunded"), "Refund will be processed after QC");
  // The first step is never pending - it exists because the customer raised it.
  assert.equal(returnPendingHint("return_requested"), null);
});

// ── Steps ──────────────────────────────────────────────────────────────────

test("a fresh request shows the whole happy path, hinting only the next step", () => {
  const steps = buildReturnSteps(request());
  assert.deepEqual(
    steps.map((s) => s.status),
    RETURN_FLOW
  );
  assert.equal(steps[0].state, "done");
  assert.equal(steps[0].description, "Return request raised. Reason: Damaged product");

  assert.equal(steps[1].status, "under_review");
  assert.equal(steps[1].state, "current");
  assert.equal(steps[1].hint, "We’ll update you once reviewed");

  // Only the current step carries a hint.
  for (const later of steps.slice(2)) {
    assert.equal(later.state, "pending");
    assert.equal(later.hint, null);
  }
});

test("an approved request hints the shipping step and shows the deadline", () => {
  const steps = buildReturnSteps(
    request({
      status: "approved",
      approvedAt: APPROVED_ON,
      shipDeadlineAt: new Date("2026-11-05T18:29:59.999Z"),
      history: [
        { id: "1", fromStatus: null, toStatus: "return_requested", action: "requested", note: null, actorType: "USER", createdAt: new Date("2026-11-01T06:00:00.000Z") },
        { id: "2", fromStatus: "return_requested", toStatus: "under_review", action: "review", note: null, actorType: "ADMIN", createdAt: new Date("2026-11-02T06:00:00.000Z") },
        { id: "3", fromStatus: "under_review", toStatus: "approved", action: "approve", note: null, actorType: "ADMIN", createdAt: APPROVED_ON },
      ],
    })
  );
  const byStatus = new Map(steps.map((s) => [s.status, s]));
  assert.equal(byStatus.get("approved")!.state, "done");
  assert.match(
    byStatus.get("approved")!.description!,
    /Please ship the item to our address before 05 Nov 2026/
  );
  assert.equal(byStatus.get("shipped_by_customer")!.state, "current");
  assert.equal(byStatus.get("shipped_by_customer")!.hint, "Add tracking details after shipping");
});

test("an exception replaces the steps that are no longer coming", () => {
  const steps = buildReturnSteps(
    request({
      status: "qc_failed",
      approvedAt: APPROVED_ON,
      qcFailedAt: new Date("2026-11-08T06:00:00.000Z"),
      qcFailureReason: "Item used",
      receivedAt: new Date("2026-11-07T06:00:00.000Z"),
      shippedAt: new Date("2026-11-04T06:00:00.000Z"),
      courierName: "Delhivery",
      trackingNumber: "AWB999",
    })
  );
  const statuses = steps.map((s) => s.status);
  // Reached steps stay, the ending is appended, nothing pending survives.
  assert.deepEqual(statuses, [
    "return_requested",
    "approved",
    "shipped_by_customer",
    "received",
    "qc_failed",
  ]);
  assert.ok(steps.every((s) => s.state === "done"));
  assert.ok(!statuses.includes("refund_pending"));
  assert.ok(!statuses.includes("refunded"));

  const last = steps.at(-1)!;
  assert.equal(last.label, "QC Failed");
  assert.equal(last.tone, "danger");
  assert.equal(
    last.description,
    "Returned item did not pass quality check. Reason: Item used"
  );
});

test("legacy pickup rows are shown as the shipping step", () => {
  const steps = buildReturnSteps(
    request({
      status: "received",
      approvedAt: APPROVED_ON,
      receivedAt: new Date("2026-11-07T06:00:00.000Z"),
      history: [
        { id: "1", fromStatus: "approved", toStatus: "pickup_scheduled", action: "pickup", note: null, actorType: "ADMIN", createdAt: new Date("2026-11-04T06:00:00.000Z") },
        { id: "2", fromStatus: "pickup_scheduled", toStatus: "picked_up", action: "picked-up", note: null, actorType: "ADMIN", createdAt: new Date("2026-11-05T06:00:00.000Z") },
      ],
    })
  );
  const ship = steps.find((s) => s.status === "shipped_by_customer");
  assert.ok(ship, "the retired pickup statuses should land on the shipping step");
  assert.equal(ship!.state, "done");
});

// ── Transitions & ship window ──────────────────────────────────────────────

test("the workflow has no pickup steps left and QC can branch either way", () => {
  assert.ok(!Object.hasOwn(RETURN_TRANSITIONS, "pickup"));
  assert.ok(!Object.hasOwn(RETURN_TRANSITIONS, "picked-up"));

  const fromReceived = availableActions(RETURN_TRANSITIONS, "received").map((a) => a.action);
  assert.deepEqual(fromReceived.sort(), ["qc-fail", "refund"]);

  const fromApproved = availableActions(RETURN_TRANSITIONS, "approved").map((a) => a.action);
  assert.deepEqual(fromApproved.sort(), ["cancel", "expire", "shipped"]);

  // Every exception ending can be closed off.
  for (const status of ["rejected", "qc_failed", "expired", "cancelled"]) {
    const actions = availableActions(RETURN_TRANSITIONS, status).map((a) => a.action);
    assert.ok(actions.includes("close" as ReturnAction), `${status} should be closable`);
  }
});

// ── Item availability ──────────────────────────────────────────────────────

test("an in-flight or completed request keeps hold of its order item", () => {
  const withItem = (status: string, over: Partial<RequestSummary> = {}) =>
    request({
      status,
      items: [
        {
          orderItemId: "oi-1",
          productName: "Shirt",
          variantName: "Blue",
          size: "M",
          color: "Blue",
          image: null,
          quantity: 1,
          unitPrice: 999,
        },
      ],
      ...over,
    });

  for (const status of [
    "return_requested",
    "under_review",
    "approved",
    "shipped_by_customer",
    "received",
    "qc_failed",
    "refund_pending",
    "refunded",
  ]) {
    assert.equal(
      isRequestConsuming(withItem(status)),
      true,
      `${status} should still hold the item`
    );
  }

  // Rejected / expired / cancelled hand the item back so a fresh request is
  // possible while the window is open.
  assert.equal(isRequestConsuming(withItem("rejected", { rejectedAt: new Date() })), false);
  assert.equal(isRequestConsuming(withItem("expired", { expiredAt: new Date() })), false);
  assert.equal(isRequestConsuming(withItem("cancelled", { cancelledAt: new Date() })), false);

  // `closed` depends on how it got there.
  assert.equal(isRequestConsuming(withItem("closed")), true);
  assert.equal(isRequestConsuming(withItem("closed", { rejectedAt: new Date() })), false);
  assert.equal(isRequestConsuming(withItem("closed", { cancelledAt: new Date() })), false);
  assert.equal(isRequestConsuming(withItem("closed", { expiredAt: new Date() })), false);

  // The id set is what the panel uses to decide whether to offer the buttons.
  assert.deepEqual([...consumedOrderItemIds([withItem("approved")])], ["oi-1"]);
  assert.deepEqual(
    [...consumedOrderItemIds([withItem("cancelled", { cancelledAt: new Date() })])],
    []
  );
});

test("the customer may only submit a slip they uploaded themselves", () => {
  // The customer action schema rejects anything outside their own slip store,
  // so a return cannot cite an arbitrary file under the document root.
  const ok = customerReturnActionSchema.safeParse({
    courierName: "Delhivery",
    trackingNumber: "AWB999",
    shippingSlipUrl: `${SHIPPING_SLIP_URL_PREFIX}u12-${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}.jpg`,
  });
  assert.equal(ok.success, true);

  const adminPath = customerReturnActionSchema.safeParse({
    courierName: "Delhivery",
    trackingNumber: "AWB999",
    shippingSlipUrl: "/document/returns/someone-elses-image.jpg",
  });
  assert.equal(adminPath.success, false);

  const offsite = customerReturnActionSchema.safeParse({
    courierName: "Delhivery",
    trackingNumber: "AWB999",
    shippingSlipUrl: "https://evil.example.com/slip.jpg",
  });
  assert.equal(offsite.success, false);

  // Staff uploads live under the document root, which stays valid for them.
  assert.equal(isShippingSlipUrl("/document/returns/slip.jpg"), true);
  assert.equal(isShippingSlipUrl("https://evil.example.com/slip.jpg"), false);
  assert.equal(isShippingSlipUrl(null), false);
});

test("a slip filename only parses for its own owner", () => {
  const uuid = "11111111-2222-3333-4444-555555555555";
  assert.deepEqual(slipService.parseFilename(`u42-${uuid}.jpg`), {
    ownerId: "42",
    extension: ".jpg",
  });
  // Traversal and unexpected extensions never produce an owner.
  assert.equal(slipService.parseFilename(`../../u42-${uuid}.jpg`), null);
  assert.equal(slipService.parseFilename(`u42-${uuid}.svg`), null);
  assert.equal(slipService.parseFilename(`u42-not-a-uuid.jpg`), null);
});

test("the ship window is three inclusive store-timezone days from approval", () => {
  const { deadline, daysLeft, expired } = getShipWindow(APPROVED_ON, APPROVED_ON);
  assert.equal(RETURN_SHIP_WINDOW_DAYS, 3);
  assert.equal(expired, false);
  assert.equal(daysLeft, 3);
  // End of 2026-11-05 IST == 2026-11-05T18:29:59.999Z
  assert.equal(deadline!.toISOString(), "2026-11-05T18:29:59.999Z");

  // One millisecond later is outside the window.
  const after = getShipWindow(APPROVED_ON, new Date("2026-11-05T18:30:00.000Z"));
  assert.equal(after.expired, true);
  assert.equal(after.daysLeft, 0);

  // Still inside on the final day.
  const lastDay = getShipWindow(APPROVED_ON, new Date("2026-11-05T12:00:00.000Z"));
  assert.equal(lastDay.expired, false);
  assert.equal(lastDay.daysLeft, 1);
});

// ── Full flow walk ─────────────────────────────────────────────────────────

/**
 * Replays the whole happy path through the transition table, the way an admin
 * and the customer would click it, and checks the timeline the customer sees
 * after every move. Catches a step that became unreachable or a sentence that
 * stopped rendering - the things a UI change can quietly break.
 */
test("the happy path walks end to end and the timeline keeps up", () => {
  const walk: Array<{ action: ReturnAction; to: string }> = [
    { action: "review", to: "under_review" },
    { action: "approve", to: "approved" },
    { action: "shipped", to: "shipped_by_customer" },
    { action: "received", to: "received" },
    { action: "refund", to: "refund_pending" },
    { action: "complete", to: "refunded" },
  ];

  let status = "return_requested";
  const history: RequestSummary["history"] = [
    { id: "0", fromStatus: null, toStatus: status, action: "requested", note: null, actorType: "USER", createdAt: new Date("2026-11-01T06:00:00.000Z") },
  ];
  const stamps: Partial<RequestSummary> = {};
  let day = 2;

  for (const move of walk) {
    const allowed = availableActions(RETURN_TRANSITIONS, status).map((a) => a.action);
    assert.ok(
      allowed.includes(move.action),
      `${move.action} must be available from ${status}, got ${allowed.join(", ")}`
    );
    const transition = RETURN_TRANSITIONS[move.action];
    assert.equal(transition.to, move.to);

    const at = new Date(`2026-11-0${day++}T06:00:00.000Z`);
    status = transition.to;
    history.push({
      id: String(history.length),
      fromStatus: history.at(-1)!.toStatus,
      toStatus: status,
      action: move.action,
      note: null,
      actorType: "ADMIN",
      createdAt: at,
    });
    if (status === "approved") stamps.approvedAt = at;
    if (status === "shipped_by_customer") stamps.shippedAt = at;
    if (status === "received") stamps.receivedAt = at;
    if (status === "refunded") stamps.completedAt = at;

    const steps = buildReturnSteps(
      request({
        ...stamps,
        status,
        courierName: "India Post",
        trackingNumber: "AWB123",
        refundAmount: 1499,
        refundMethod: "upi",
        upiId: "shopper@upi",
        refundTransactionRef: status === "refunded" ? "TXN-77" : null,
        history: [...history],
      })
    );
    const reached = steps.filter((s) => s.state === "done");

    // Every move lands on the step it claims, carrying a sentence.
    assert.equal(reached.at(-1)!.status, status, `last done step after ${move.action}`);
    assert.ok(reached.at(-1)!.description, `${status} must render a sentence`);
    // Earlier steps stay done, later ones stay ahead, and exactly one step is
    // being waited on until the request is finished.
    const current = steps.filter((s) => s.state === "current");
    assert.equal(current.length, status === "refunded" ? 0 : 1, `one current step at ${status}`);
    if (current[0]) assert.ok(current[0].hint, `${current[0].status} needs a pending hint`);
  }

  assert.equal(status, "refunded");
  const final = buildReturnSteps(
    request({
      ...stamps,
      status,
      refundAmount: 1499,
      refundMethod: "upi",
      upiId: "shopper@upi",
      refundTransactionRef: "TXN-77",
      history,
    })
  );
  assert.deepEqual(
    final.map((s) => s.status),
    RETURN_FLOW
  );
  assert.ok(final.every((s) => s.state === "done"));
  assert.equal(
    final.at(-1)!.description,
    "₹1,499.00 refunded to UPI (shopper@upi). Ref no: TXN-77"
  );
  assert.equal(final.at(-1)!.tone, "success");
});

test("every status the flow can end on is reachable and says something", () => {
  const reachable = new Set<string>(["return_requested"]);
  // Fixed point over the transition table: anything an action can produce from
  // a reachable status is itself reachable.
  for (let pass = 0; pass < RETURN_FLOW.length + 5; pass += 1) {
    for (const transition of Object.values(RETURN_TRANSITIONS)) {
      if (transition.from.some((f) => reachable.has(f))) reachable.add(transition.to);
    }
  }
  for (const status of [...RETURN_FLOW, "rejected", "qc_failed", "expired", "cancelled", "closed"]) {
    assert.ok(reachable.has(status), `${status} is unreachable`);
    assert.ok(returnStatusMessage(status).length > 0, `${status} has no sentence`);
    assert.notEqual(returnStatusLabel(status), status, `${status} has no label`);
  }
});

test("the refund sentence names the amount, the destination and the reference", () => {
  const steps = buildReturnSteps(
    request({
      status: "refund_pending",
      approvedAt: APPROVED_ON,
      receivedAt: new Date("2026-11-07T06:00:00.000Z"),
      shippedAt: new Date("2026-11-04T06:00:00.000Z"),
      refundAmount: 2499.5,
      refundMethod: "bank_transfer",
      bankAccountLast4: "4321",
    })
  );
  const pending = steps.find((s) => s.status === "refund_pending")!;
  assert.equal(pending.state, "done");
  assert.match(pending.description!, /Refund of ₹2,499.50 will be credited within 5–7 working days/);

  const paid = buildReturnSteps(
    request({
      status: "refunded",
      approvedAt: APPROVED_ON,
      completedAt: new Date("2026-11-09T06:00:00.000Z"),
      refundAmount: 2499.5,
      refundMethod: "bank_transfer",
      bankAccountLast4: "4321",
      refundTransactionRef: "UTR-9001",
    })
  ).at(-1)!;
  assert.equal(
    paid.description,
    "₹2,499.50 refunded to your bank account 4321. Ref no: UTR-9001"
  );
});

test("a step the request moved past without visiting is dropped, not left current", () => {
  // Approved straight from the request, with no separate review, and already
  // refunded. Nothing is still "in progress" on a finished request.
  const steps = buildReturnSteps(
    request({
      status: "refunded",
      approvedAt: APPROVED_ON,
      shippedAt: new Date("2026-11-04T06:00:00.000Z"),
      receivedAt: new Date("2026-11-06T06:00:00.000Z"),
      completedAt: new Date("2026-11-08T06:00:00.000Z"),
      refundAmount: 999,
      refundMethod: "upi",
      upiId: "shopper@upi",
    })
  );
  const statuses = steps.map((s) => s.status);
  assert.ok(!statuses.includes("under_review"), "a skipped review must not be shown");
  assert.ok(!statuses.includes("refund_pending"), "a skipped QC pass must not be shown");
  assert.equal(steps.filter((s) => s.state !== "done").length, 0);
  assert.equal(steps.at(-1)!.status, "refunded");
});

test("the step being waited on is the one after the request's own status", () => {
  const steps = buildReturnSteps(
    request({ status: "received", approvedAt: APPROVED_ON, receivedAt: new Date("2026-11-06T06:00:00.000Z") })
  );
  const current = steps.filter((s) => s.state === "current");
  assert.equal(current.length, 1);
  assert.equal(current[0].status, "refund_pending");
  // Everything before the current step has been reached.
  const upto = steps.slice(0, steps.indexOf(current[0]));
  assert.ok(upto.every((s) => s.state === "done"));
});
