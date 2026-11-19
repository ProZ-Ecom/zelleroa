"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Printer,
  Smartphone,
  Store,
  Tag,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/Toast";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { useCan } from "@/features/access";
import { usePurchaseDetail, useVoidBill } from "../hooks/use-pos";
import { printReceipt } from "./PosReceipt";
import type { PosBillDto, PosPaymentMode } from "../types";

interface PosPurchaseDetailModalProps {
  orderUuid: string | null;
  open: boolean;
  onClose: () => void;
  initialBill?: PosBillDto | null;
  onVoidSuccess?: () => void;
  isVoided?: boolean;
}

const PAYMENT_ICONS: Record<PosPaymentMode, typeof Banknote> = {
  CASH: Banknote,
  UPI: Smartphone,
  CARD: CreditCard,
};

export function PosPurchaseDetailModal({
  orderUuid,
  open,
  onClose,
  initialBill,
  onVoidSuccess,
  isVoided = false,
}: PosPurchaseDetailModalProps) {
  const { data: fetchedBill, isLoading } = usePurchaseDetail(open ? orderUuid : null);
  const bill = initialBill || fetchedBill;

  const mayVoid = useCan("POS_VOID");
  const voidBillMutation = useVoidBill();

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  const handleVoid = async () => {
    if (!bill?.orderUuid) return;
    const reason = voidReason.trim();
    if (!reason) {
      toast.error("Please enter a reason for voiding this bill");
      return;
    }

    setVoiding(true);
    try {
      await voidBillMutation.mutateAsync({
        orderUuid: bill.orderUuid,
        reason,
      });
      setVoidDialogOpen(false);
      setVoidReason("");
      onVoidSuccess?.();
      onClose();
    } catch {
      // Error handled by mutation
    } finally {
      setVoiding(false);
    }
  };

  const PaymentIcon = bill?.paymentMode ? PAYMENT_ICONS[bill.paymentMode] : Banknote;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden"
      >
        {isLoading && !bill ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            <p className="text-sm text-neutral-500">Loading purchase details...</p>
          </div>
        ) : !bill ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 p-6 text-center">
            <XCircle className="h-10 w-10 text-neutral-300" />
            <p className="text-base font-semibold text-neutral-900">Purchase not found</p>
            <p className="text-sm text-neutral-500">Could not load details for this purchase bill.</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 flex-col">
            {/* Header */}
            <div className="border-b border-neutral-100 bg-neutral-50/60 px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-neutral-900">
                      {bill.invoiceNumber || bill.orderNumber}
                    </h2>
                    {isVoided ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-red-700">
                        <XCircle className="h-3 w-3" />
                        Voided
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Order <span className="font-mono text-neutral-700">{bill.orderNumber}</span> ·{" "}
                    {formatDateTime(bill.billedAt)}
                  </p>
                </div>
              </div>

              {/* Meta details */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 rounded-xl bg-white p-3 text-xs shadow-sm ring-1 ring-neutral-200/60 sm:grid-cols-3">
                <div>
                  <p className="text-neutral-400">Store</p>
                  <p className="mt-0.5 font-medium text-neutral-800">{bill.store?.name || "Counter"}</p>
                </div>
                <div>
                  <p className="text-neutral-400">Cashier</p>
                  <p className="mt-0.5 font-medium text-neutral-800">{bill.cashierName || "Staff"}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-neutral-400">Customer</p>
                  <p className="mt-0.5 font-medium text-neutral-800">
                    {bill.customerName || "Walk-in Customer"}
                    {bill.customerPhone && (
                      <span className="ml-1 text-neutral-500 font-normal">({bill.customerPhone})</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable item list and breakdown */}
            <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Purchased Items ({bill.lines.length})
              </h3>

              <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full text-xs min-w-[460px]">
                  <thead className="bg-neutral-50 text-neutral-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Item & SKU</th>
                      <th className="px-3 py-2 text-center font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Unit Rate</th>
                      <th className="px-3 py-2 text-right font-medium">Discount</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {bill.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-neutral-900">{line.description}</p>
                          <p className="font-mono text-[11px] text-neutral-400">{line.sku}</p>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-neutral-700">
                          {line.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">
                          {formatPrice(line.unitPrice)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">
                          {line.discountAmount > 0 ? `-${formatPrice(line.discountAmount)}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-neutral-900">
                          {formatPrice(line.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Breakdown */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Payment information card */}
                <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3.5 text-xs">
                  <p className="font-semibold text-neutral-900">Payment Information</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
                      <PaymentIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {bill.paymentMode === "CASH"
                          ? "Cash Payment"
                          : bill.paymentMode === "UPI"
                            ? "UPI Payment"
                            : "Card Payment"}
                      </p>
                      <p className="text-[11px] text-neutral-500">Collected at register</p>
                    </div>
                  </div>

                  {bill.couponCode && (
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 px-2.5 py-1.5 text-emerald-800">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Tag className="h-3.5 w-3.5 text-emerald-600" />
                        Coupon Applied
                      </span>
                      <span className="font-mono font-bold">{bill.couponCode}</span>
                    </div>
                  )}
                </div>

                {/* Amount breakdown */}
                <div className="rounded-xl border border-neutral-200 bg-white p-3.5 text-xs space-y-1.5">
                  <div className="flex justify-between text-neutral-500">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatPrice(bill.subtotal)}</span>
                  </div>

                  {bill.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Total Discounts</span>
                      <span className="tabular-nums font-medium">-{formatPrice(bill.discountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-neutral-500">
                    <span>Taxable Value</span>
                    <span className="tabular-nums">{formatPrice(bill.taxableValue)}</span>
                  </div>

                  <div className="flex justify-between text-neutral-500">
                    <span>CGST</span>
                    <span className="tabular-nums">{formatPrice(bill.cgstAmount)}</span>
                  </div>

                  <div className="flex justify-between text-neutral-500">
                    <span>SGST</span>
                    <span className="tabular-nums">{formatPrice(bill.sgstAmount)}</span>
                  </div>

                  <div className="border-t border-neutral-100 pt-1.5 flex justify-between text-sm font-bold text-neutral-900">
                    <span>Net Paid</span>
                    <span className="tabular-nums text-base">{formatPrice(bill.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom action footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-4 py-3 sm:px-6 sm:py-3.5">
              <div className="flex items-center gap-2">
                {!isVoided && mayVoid && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVoidDialogOpen(true)}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Void Bill
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/invoice/${bill.orderUuid}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
                  Tax Invoice
                </Link>

                <Button
                  size="sm"
                  onClick={() => printReceipt(bill)}
                  className="gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Receipt
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Void bill confirmation prompt */}
      <Modal
        open={voidDialogOpen}
        onClose={() => setVoidDialogOpen(false)}
        className="max-w-md p-6"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-red-100 p-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900">Void Counter Bill?</h3>
            <p className="mt-1 text-xs text-neutral-500">
              This will cancel bill <strong className="text-neutral-700">{bill?.invoiceNumber}</strong>,
              return items back to available inventory, and flag the transaction as voided.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-neutral-700">
            Reason for voiding <span className="text-red-500">*</span>
          </label>
          <Input
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. Customer cancelled, wrong item rung up"
            className="mt-1.5 text-xs"
            autoFocus
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVoidDialogOpen(false)}
            disabled={voiding}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleVoid}
            disabled={voiding || !voidReason.trim()}
          >
            {voiding ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Voiding...
              </>
            ) : (
              "Confirm Void"
            )}
          </Button>
        </div>
      </Modal>
    </>
  );
}
