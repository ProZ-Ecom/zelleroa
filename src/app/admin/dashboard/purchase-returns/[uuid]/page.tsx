"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Ban, Check, FileText, Info, Send } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormModal } from "@/components/common/FormModal";
import { usePurchaseReturn, usePurchaseReturnMutations } from "@/features/purchases/hooks";
import {
  PurchaseReturnStatusBadge,
  returnReasonLabels,
} from "@/features/purchases/components/PurchaseReturnBadges";

const primaryBtn =
  "h-10 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-4 text-sm font-semibold text-white transition-colors";

const money = (n: number) => `₹${n.toFixed(2)}`;
const fmt = (d: string) => new Date(d).toLocaleString();

export default function PurchaseReturnDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { data: ret, isLoading, error, refetch } = usePurchaseReturn(uuid);
  const { act } = usePurchaseReturnMutations();

  const [completeOpen, setCompleteOpen] = useState(false);
  const [debitNote, setDebitNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (isLoading) return <AdminTableSkeleton />;
  if (error || !ret) return <ErrorState message="Failed to load purchase return" onRetry={() => refetch()} />;

  const s = ret.status;
  const open = s === "DRAFT" || s === "SUBMITTED";
  const nonStockUnits = (ret.items ?? []).reduce((n, i) => n + (i.affectsStock ? 0 : i.quantity), 0);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader
        title={ret.returnNumber}
        description={`${ret.vendor.name} (${ret.vendor.code}) · against ${ret.purchaseOrder.poNumber}`}
        breadcrumbs={
          <Link
            href="/admin/dashboard/purchase-returns"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" /> Purchase returns
          </Link>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PurchaseReturnStatusBadge status={s} />
            <Link href={`/admin/dashboard/purchase-returns/${uuid}/debit-note`} target="_blank">
              <Button variant="outline" className="h-10 rounded-xl">
                <FileText className="mr-2 h-4 w-4" /> Debit note
              </Button>
            </Link>
            {s === "DRAFT" && (
              <Button
                className={primaryBtn}
                isLoading={act.isPending}
                onClick={() => act.mutateAsync({ uuid, action: "submit" })}
              >
                <Send className="mr-2 h-4 w-4" /> Send to vendor
              </Button>
            )}
            {open && (
              <Button className={primaryBtn} onClick={() => setCompleteOpen(true)}>
                <Check className="mr-2 h-4 w-4" /> Complete return
              </Button>
            )}
            {open && (
              <Button variant="outline" className="h-10 rounded-xl" onClick={() => setCancelOpen(true)}>
                <Ban className="mr-2 h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="mt-6 grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {nonStockUnits > 0 && (
            <div className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {nonStockUnits} unit(s) on this return were refused when the goods arrived, so they never
                entered stock. Completing this return claims the money back without changing stock.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Unit cost</th>
                  <th className="px-4 py-3 text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {ret.items?.map((i) => (
                  <tr key={i.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3">
                      <p className="font-medium">{i.productName}</p>
                      <p className="text-xs text-neutral-500">
                        {[i.variantName, i.colorName, i.sizeName ?? i.unitName].filter(Boolean).join(" · ")} ·{" "}
                        {i.sku}
                      </p>
                      {i.notes && <p className="mt-1 text-xs text-neutral-600">{i.notes}</p>}
                    </td>
                    <td className="px-4 py-3">{returnReasonLabels[i.reason]}</td>
                    <td className="px-4 py-3">{i.quantity}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {i.affectsStock ? "Leaves stock" : "Never stocked"}
                    </td>
                    <td className="px-4 py-3">{money(i.unitCost)}</td>
                    <td className="px-4 py-3 text-right font-medium">{money(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50">
                  <td colSpan={5} className="px-4 py-3 text-right font-semibold">
                    Debit note value
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{money(ret.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 text-sm">
            <h3 className="mb-3 font-semibold">Details</h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Purchase order</dt>
                <dd>
                  <Link
                    href={`/admin/dashboard/purchase-orders/${ret.purchaseOrder.id}`}
                    className="text-[var(--color-primary-600)] hover:underline"
                  >
                    {ret.purchaseOrder.poNumber}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Vendor invoice</dt>
                <dd>{ret.purchaseOrder.invoiceNumber ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Return date</dt>
                <dd>{ret.returnDate ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Debit note no.</dt>
                <dd>{ret.debitNoteNumber ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Units leaving stock</dt>
                <dd>{ret.stockUnits}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Created</dt>
                <dd>{fmt(ret.createdAt)}</dd>
              </div>
              {ret.completedAt && (
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Completed</dt>
                  <dd>{fmt(ret.completedAt)}</dd>
                </div>
              )}
              {ret.cancelledAt && (
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Cancelled</dt>
                  <dd>{fmt(ret.cancelledAt)}</dd>
                </div>
              )}
            </dl>
            {ret.notes && (
              <p className="mt-3 whitespace-pre-line border-t border-neutral-100 pt-3 text-neutral-700">
                {ret.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      <FormModal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Complete return"
        description={
          ret.stockUnits > 0
            ? `${ret.stockUnits} unit(s) will be taken out of stock. This cannot be undone.`
            : "No stock moves - these units never reached stock. The debit note is recorded as settled."
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Vendor debit note number (optional)
            </label>
            <Input
              value={debitNote}
              maxLength={60}
              placeholder="e.g. DN-4471"
              onChange={(e) => setDebitNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              className={primaryBtn}
              isLoading={act.isPending}
              onClick={async () => {
                await act.mutateAsync({
                  uuid,
                  action: "complete",
                  debitNoteNumber: debitNote.trim() || undefined,
                });
                setCompleteOpen(false);
                setDebitNote("");
              }}
            >
              Complete return
            </Button>
          </div>
        </div>
      </FormModal>

      <FormModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel purchase return"
        description="Nothing has left stock yet. The reason is kept on the record."
      >
        <div className="space-y-4">
          <Textarea
            placeholder="Reason for cancelling"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              className={primaryBtn}
              isLoading={act.isPending}
              disabled={!reason.trim()}
              onClick={async () => {
                await act.mutateAsync({ uuid, action: "cancel", reason: reason.trim() });
                setCancelOpen(false);
                setReason("");
              }}
            >
              Cancel return
            </Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
