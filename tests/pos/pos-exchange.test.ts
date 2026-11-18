import { test } from "node:test";
import assert from "node:assert/strict";
import { exchangeReceiptText } from "@/features/pos/services/pos-receipt.service";
import type { PosExchangeReceiptDto } from "@/features/pos/types";

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function calculateEffectiveCredit(originalTotalPrice: number, originalQuantity: number, returnQuantity: number) {
  const effectiveUnitPrice = originalQuantity > 0 ? round2(originalTotalPrice / originalQuantity) : 0;
  return round2(effectiveUnitPrice * returnQuantity);
}

function evaluateExchangeSettlement(returnCredit: number, replacementTotal: number) {
  const netPayable = round2(replacementTotal - returnCredit);
  if (netPayable < 0) {
    const deficit = Math.abs(netPayable);
    return {
      allowed: false,
      deficit,
      netPayable,
      errorMessage: `Your exchange balance is ₹${returnCredit.toFixed(2)}. Please select additional products worth ₹${deficit.toFixed(2)} to complete the exchange. Unused exchange balance cannot be refunded or converted into a voucher or store credit.`,
    };
  }
  return {
    allowed: true,
    deficit: 0,
    netPayable,
    errorMessage: null,
  };
}

function checkEligibility(purchasedQuantity: number, previouslyExchanged: number, requestedReturn: number) {
  const eligibleQuantity = Math.max(0, purchasedQuantity - previouslyExchanged);
  if (requestedReturn > eligibleQuantity) {
    return {
      valid: false,
      eligibleQuantity,
      error: `Cannot return ${requestedReturn} unit(s). Only ${eligibleQuantity} eligible unit(s) remaining.`,
    };
  }
  return { valid: true, eligibleQuantity, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1: Same-value exchange (₹1,499 ↔ ₹1,499)
// ─────────────────────────────────────────────────────────────────────────────
test("Scenario 1: Same-value exchange requires no additional payment", () => {
  const returnCredit = calculateEffectiveCredit(1499, 1, 1);
  const replacementTotal = 1499;

  const result = evaluateExchangeSettlement(returnCredit, replacementTotal);
  assert.equal(result.allowed, true);
  assert.equal(result.netPayable, 0);
  assert.equal(result.deficit, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2: Higher-value exchange (₹1,200 ↔ ₹2,500)
// ─────────────────────────────────────────────────────────────────────────────
test("Scenario 2: Higher-value exchange calculates positive net payable difference", () => {
  const returnCredit = calculateEffectiveCredit(1200, 1, 1);
  const replacementTotal = 2500;

  const result = evaluateExchangeSettlement(returnCredit, replacementTotal);
  assert.equal(result.allowed, true);
  assert.equal(result.netPayable, 1300);
  assert.equal(result.deficit, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3: Lower-value exchange – Mandatory Full Value Utilization
// ─────────────────────────────────────────────────────────────────────────────
test("Scenario 3: Lower-value exchange is strictly BLOCKED until full credit is utilized", () => {
  const returnCredit = calculateEffectiveCredit(2000, 1, 1); // ₹2,000 returned
  const replacementTotal = 1500; // Customer picked ₹1,500

  const result = evaluateExchangeSettlement(returnCredit, replacementTotal);
  assert.equal(result.allowed, false);
  assert.equal(result.deficit, 500);
  assert.equal(result.netPayable, -500);
  assert.ok(result.errorMessage?.includes("Please select additional products worth ₹500.00 to complete the exchange"));
  assert.ok(result.errorMessage?.includes("Unused exchange balance cannot be refunded or converted into a voucher or store credit"));
});

test("Scenario 3b: Lower-value exchange with additional product reaching exact value is permitted at ₹0", () => {
  const returnCredit = calculateEffectiveCredit(2000, 1, 1); // ₹2,000 returned
  const replacementTotal = 1500 + 500; // Customer picked ₹1,500 + ₹500 = ₹2,000

  const result = evaluateExchangeSettlement(returnCredit, replacementTotal);
  assert.equal(result.allowed, true);
  assert.equal(result.netPayable, 0);
  assert.equal(result.deficit, 0);
});

test("Scenario 3c: Lower-value exchange with additional products exceeding original credit collects difference", () => {
  const returnCredit = calculateEffectiveCredit(2000, 1, 1); // ₹2,000 returned
  const replacementTotal = 1500 + 700; // Customer picked ₹1,500 + ₹700 = ₹2,200

  const result = evaluateExchangeSettlement(returnCredit, replacementTotal);
  assert.equal(result.allowed, true);
  assert.equal(result.netPayable, 200);
  assert.equal(result.deficit, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 4: Defective Same-Product Replacement
// ─────────────────────────────────────────────────────────────────────────────
test("Scenario 4: Defective same-product replacement settles at ₹0 with identical SKU", () => {
  const returnCredit = calculateEffectiveCredit(1499, 1, 1);
  const replacementTotal = 1499;

  const result = evaluateExchangeSettlement(returnCredit, replacementTotal);
  assert.equal(result.allowed, true);
  assert.equal(result.netPayable, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Discounted Original Purchase Calculations
// ─────────────────────────────────────────────────────────────────────────────
test("Discounted original purchase return credit calculates actual paid price, not catalogue MRP", () => {
  // Originally bought 2 T-shirts at catalogue ₹1,499 each (subtotal ₹2,998)
  // Discount coupon of ₹598 was applied, so total_price recorded on line item was ₹2,400 (₹1,200 each).
  const lineItemTotalPrice = 2400;
  const purchasedQuantity = 2;
  const returnQuantity = 1;

  const credit = calculateEffectiveCredit(lineItemTotalPrice, purchasedQuantity, returnQuantity);
  assert.equal(credit, 1200); // Must be ₹1,200, not ₹1,499
});

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate Exchanges & Eligibility Checks
// ─────────────────────────────────────────────────────────────────────────────
test("Duplicate exchange prevention rejects requests exceeding remaining eligible quantity", () => {
  const purchased = 2;
  const previouslyExchanged = 2;
  const requested = 1;

  const check = checkEligibility(purchased, previouslyExchanged, requested);
  assert.equal(check.valid, false);
  assert.equal(check.eligibleQuantity, 0);
  assert.ok(check.error?.includes("Only 0 eligible unit(s) remaining"));
});

test("Partial exchange tracks remaining eligible quantity correctly", () => {
  const purchased = 3;
  const previouslyExchanged = 1;
  const requested = 2;

  const check = checkEligibility(purchased, previouslyExchanged, requested);
  assert.equal(check.valid, true);
  assert.equal(check.eligibleQuantity, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Thermal Exchange Receipt Formatting
// ─────────────────────────────────────────────────────────────────────────────
test("Exchange thermal receipt text renders dual sections, no vouchers, and clear settlement", () => {
  const receiptDto: PosExchangeReceiptDto = {
    exchangeUuid: "test-uuid",
    exchangeNumber: "ZEL/EXCH/26-27/0014",
    originalOrderNumber: "POS-20261112-0042",
    originalInvoiceNumber: "ZEL/26-27/0042",
    originalPlacedAt: "2026-11-12T10:30:00.000Z",
    exchangedAt: "2026-11-16T12:00:00.000Z",
    store: {
      id: 1,
      uuid: "store-uuid",
      name: "Zellora Brigade Road",
      code: "BRG",
      addressLines: ["Brigade Road, Bengaluru"],
      city: "Bengaluru",
      state: "Karnataka",
      stateCode: "29",
      pincode: "560001",
      phone: "080-12345678",
      gstin: "29AAAAA0000A1Z5",
      invoicePrefix: "ZEL",
      maxCashierDiscountPercent: 10,
    },
    cashierName: "Syed",
    approvingManagerName: null,
    customerName: "Rahul Sharma",
    customerPhone: "9876543210",
    returnLines: [
      {
        orderItemId: 101,
        sku: "TSH-BLK-M",
        description: "Classic Crew T-Shirt (Black/M)",
        quantity: 1,
        unitPrice: 1200,
        lineTotal: 1200,
        condition: "RESTOCKABLE",
        reason: "Size Issue",
      },
    ],
    newLines: [
      {
        sku: "SHT-NVY-L",
        description: "Linen Casual Shirt (Navy/L)",
        quantity: 1,
        unitPrice: 2500,
        discountAmount: 0,
        lineTotal: 2500,
      },
    ],
    totalReturnedValue: 1200,
    totalNewValue: 2500,
    netPayable: 1300,
    paymentMode: "UPI",
    cashReceived: null,
    changeDue: null,
    paymentReference: "UPI-Ref-432198",
    reason: "Size Issue",
    notes: null,
    taxableValue: 2380.95,
    cgstAmount: 59.52,
    sgstAmount: 59.53,
  };

  const receipt = exchangeReceiptText(receiptDto);
  assert.ok(receipt.includes("EXCHANGE: ZEL/EXCH/26-27/0014"));
  assert.ok(receipt.includes("Orig Bill: ZEL/26-27/0042"));
  assert.ok(receipt.includes("RETURNED ITEMS (CREDIT):"));
  assert.ok(receipt.includes("ISSUED REPLACEMENTS (DEBIT):"));
  assert.ok(receipt.includes("Return Credit"));
  assert.ok(receipt.includes("-1200.00"));
  assert.ok(receipt.includes("New Total"));
  assert.ok(receipt.includes("+2500.00"));
  assert.ok(receipt.includes("NET PAYABLE"));
  assert.ok(receipt.includes("1300.00"));
  assert.ok(receipt.includes("UPI"));
  assert.ok(!receipt.includes("voucher"));
  assert.ok(!receipt.includes("store credit"));
});
