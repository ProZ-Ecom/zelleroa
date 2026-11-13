"use client";

import { useEffect, useRef } from "react";
import type { PosBillDto } from "../types";

const money = (value: number) => value.toFixed(2);

/**
 * The 80mm thermal receipt.
 *
 * Printed by writing it into a hidden iframe rather than `window.print()` on
 * the page: the billing screen must stay exactly as it is behind the print
 * dialog, and the roll needs its own page size, which a print stylesheet on the
 * admin layout cannot give it without fighting every other admin screen.
 */
export function PosReceipt({
  bill,
  autoPrint = true,
  onPrinted,
}: {
  bill: PosBillDto;
  autoPrint?: boolean;
  onPrinted?: () => void;
}) {
  const printed = useRef(false);

  useEffect(() => {
    if (!autoPrint || printed.current) return;
    printed.current = true;
    printReceipt(bill);
    onPrinted?.();
  }, [autoPrint, bill, onPrinted]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 font-mono text-[11px] leading-tight text-neutral-800">
      <pre className="whitespace-pre-wrap">{receiptText(bill)}</pre>
    </div>
  );
}

/** Plain-text receipt, also what the on-screen preview shows. */
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
  if (bill.discountAmount > 0) out.push(row("Discount", `-${money(bill.discountAmount)}`));
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

/** Send one receipt to the printer through a throwaway iframe. */
export function printReceipt(bill: PosBillDto) {
  if (typeof window === "undefined") return;

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const doc = frame.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }

  doc.open();
  doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${bill.invoiceNumber}</title>
    <style>
      @page { size: 80mm auto; margin: 3mm; }
      body { margin: 0; font-family: "Courier New", monospace; font-size: 11px; line-height: 1.25; }
      pre { margin: 0; white-space: pre-wrap; }
    </style>
  </head>
  <body><pre>${receiptText(bill).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</pre></body>
</html>`);
  doc.close();

  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // Give the print dialog time to take the document before it is removed.
    window.setTimeout(() => frame.remove(), 1000);
  };

  if (frame.contentWindow?.document.readyState === "complete") run();
  else frame.onload = run;
}
