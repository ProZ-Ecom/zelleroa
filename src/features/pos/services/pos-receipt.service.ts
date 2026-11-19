import type { PosBillDto, PosExchangeReceiptDto } from "../types";

const money = (value: number) => value.toFixed(2);

/** Plain-text 80mm thermal receipt for standard counter sales. */
export function receiptText(bill: PosBillDto): string {
  const width = 32;
  const line = "-".repeat(width);
  const row = (left: string, right: string) => {
    const space = Math.max(1, width - left.length - right.length);
    return `${left}${" ".repeat(space)}${right}`;
  };

  const out: string[] = [];
  out.push(bill.store.name.toUpperCase());
  for (const addressLine of bill.store.addressLines) out.push(addressLine);
  if (bill.store.phone) out.push(`Ph: ${bill.store.phone}`);
  if (bill.store.gstin) out.push(`GSTIN: ${bill.store.gstin}`);
  out.push(line);
  out.push(`Bill : ${bill.invoiceNumber}`);
  out.push(`Date : ${new Date(bill.billedAt).toLocaleString("en-IN")}`);
  out.push(`Staff: ${bill.cashierName}`);
  if (bill.customerName) out.push(`Cust : ${bill.customerName}`);
  if (bill.customerPhone) out.push(`Phone: ${bill.customerPhone}`);
  out.push(line);

  for (const item of bill.lines) {
    out.push(item.description.slice(0, width));
    out.push(row(`  ${item.quantity} x ${money(item.unitPrice)}`, money(item.lineTotal)));
    if (item.discountAmount > 0) out.push(row("  Discount", `-${money(item.discountAmount)}`));
  }

  out.push(line);
  out.push(row("Subtotal", money(bill.subtotal)));
  if (bill.couponCode && (bill.couponDiscount ?? 0) > 0) {
    const otherDiscount = bill.discountAmount - (bill.couponDiscount ?? 0);
    if (otherDiscount > 0) {
      out.push(row("Discount", `-${money(otherDiscount)}`));
    }
    out.push(row(`Coupon (${bill.couponCode})`, `-${money(bill.couponDiscount ?? 0)}`));
  } else if (bill.discountAmount > 0) {
    out.push(row("Discount", `-${money(bill.discountAmount)}`));
  }
  out.push(row("Taxable", money(bill.taxableValue)));
  out.push(row("CGST", money(bill.cgstAmount)));
  out.push(row("SGST", money(bill.sgstAmount)));
  out.push(line);
  out.push(row("TOTAL", money(bill.totalAmount)));
  out.push(row(bill.paymentMode, money(bill.totalAmount)));
  if (bill.cashReceived !== null) {
    out.push(row("Received", money(bill.cashReceived)));
    out.push(row("Change", money(bill.changeDue ?? 0)));
  }
  out.push(line);
  out.push("   Thank you! Visit again");
  out.push("");
  return out.join("\n");
}

/** Plain-text 80mm thermal receipt for Returns and Exchanges. */
export function exchangeReceiptText(exch: PosExchangeReceiptDto): string {
  const width = 32;
  const line = "-".repeat(width);
  const row = (left: string, right: string) => {
    const space = Math.max(1, width - left.length - right.length);
    return `${left}${" ".repeat(space)}${right}`;
  };

  const out: string[] = [];
  out.push(exch.store.name.toUpperCase());
  for (const addressLine of exch.store.addressLines) out.push(addressLine);
  if (exch.store.phone) out.push(`Ph: ${exch.store.phone}`);
  if (exch.store.gstin) out.push(`GSTIN: ${exch.store.gstin}`);
  out.push(line);
  out.push(`EXCHANGE: ${exch.exchangeNumber}`);
  out.push(`Orig Bill: ${exch.originalInvoiceNumber ?? exch.originalOrderNumber}`);
  out.push(`Orig Date: ${new Date(exch.originalPlacedAt).toLocaleDateString("en-IN")}`);
  out.push(`Exch Date: ${new Date(exch.exchangedAt).toLocaleString("en-IN")}`);
  out.push(`Staff    : ${exch.cashierName}`);
  if (exch.approvingManagerName) out.push(`Manager  : ${exch.approvingManagerName}`);
  if (exch.customerName) out.push(`Cust     : ${exch.customerName}`);
  if (exch.customerPhone) out.push(`Phone    : ${exch.customerPhone}`);
  if (exch.reason) out.push(`Reason   : ${exch.reason}`);
  out.push(line);

  out.push("RETURNED ITEMS (CREDIT):");
  for (const item of exch.returnLines) {
    out.push(item.description.slice(0, width));
    const condTag = item.condition === "DEFECTIVE" ? "[DEFECTIVE]" : "[RESTOCK]";
    out.push(
      row(`  ${item.quantity} x ${money(item.unitPrice)} ${condTag}`, `-${money(item.lineTotal)}`)
    );
  }

  out.push(line);
  out.push("ISSUED REPLACEMENTS (DEBIT):");
  for (const item of exch.newLines) {
    out.push(item.description.slice(0, width));
    out.push(row(`  ${item.quantity} x ${money(item.unitPrice)}`, `+${money(item.lineTotal)}`));
  }

  out.push(line);
  out.push(row("Return Credit", `-${money(exch.totalReturnedValue)}`));
  out.push(row("New Total", `+${money(exch.totalNewValue)}`));
  if (exch.taxableValue !== undefined && exch.taxableValue > 0) {
    out.push(row("Taxable", money(exch.taxableValue)));
    if (exch.cgstAmount !== undefined) out.push(row("CGST", money(exch.cgstAmount)));
    if (exch.sgstAmount !== undefined) out.push(row("SGST", money(exch.sgstAmount)));
  }
  out.push(line);
  out.push(row("NET PAYABLE", money(exch.netPayable)));

  if (exch.netPayable > 0 && exch.paymentMode) {
    out.push(row(exch.paymentMode, money(exch.netPayable)));
    if (exch.cashReceived !== null) {
      out.push(row("Received", money(exch.cashReceived)));
      out.push(row("Change", money(exch.changeDue ?? 0)));
    }
    if (exch.paymentReference) {
      out.push(`Ref: ${exch.paymentReference.slice(0, width - 5)}`);
    }
  } else {
    out.push(row("EXCHANGE SETTLED", "Rs 0.00"));
  }

  out.push(line);
  out.push("  Exchange completed safely");
  out.push("   Thank you! Visit again");
  out.push("");
  return out.join("\n");
}
