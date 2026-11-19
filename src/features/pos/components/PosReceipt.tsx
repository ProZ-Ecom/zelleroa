"use client";

import { useEffect, useRef } from "react";
import type { PosBillDto, PosExchangeReceiptDto } from "../types";
import { exchangeReceiptText, receiptText } from "../services/pos-receipt.service";

export { exchangeReceiptText, receiptText };

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
    window.setTimeout(() => frame.remove(), 1000);
  };

  if (frame.contentWindow?.document.readyState === "complete") run();
  else frame.onload = run;
}

/** Print an exchange receipt via throwaway iframe. */
export function printExchangeReceipt(exchange: PosExchangeReceiptDto) {
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
    <title>${exchange.exchangeNumber}</title>
    <style>
      @page { size: 80mm auto; margin: 3mm; }
      body { margin: 0; font-family: "Courier New", monospace; font-size: 11px; line-height: 1.25; }
      pre { margin: 0; white-space: pre-wrap; }
    </style>
  </head>
  <body><pre>${exchangeReceiptText(exchange).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</pre></body>
</html>`);
  doc.close();

  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };

  if (frame.contentWindow?.document.readyState === "complete") run();
  else frame.onload = run;
}
