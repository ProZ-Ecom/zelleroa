"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Check, X, Send, Truck, PackageCheck, Pencil, Ban } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { usePurchaseOrder, usePurchaseMutations } from "@/features/purchases/hooks";
import { PurchaseStatusBadge } from "@/features/purchases/components/PurchaseStatusBadge";
import type { PurchaseOrderResponse } from "@/features/purchases/types";

const primaryBtn =
  "h-10 rounded-xl bg-[var(--color-secondary-600)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-secondary-700)]";

function fmt(d: string) {
  return new Date(d).toLocaleString();
}

function ReceiveModal({
  po,
  open,
  onClose,
}: {
  po: PurchaseOrderResponse;
  open: boolean;
  onClose: () => void;
}) {
  const { receive } = usePurchaseMutations();
  const items = (po.items ?? []).filter((i) => i.quantityReceived < i.quantityOrdered);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const lines = items
      .map((i) => ({ itemId: i.id, quantity: qty[i.id] ?? 0 }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) return setError("Enter a quantity for at least one item");
    for (const l of lines) {
      const item = items.find((i) => i.id === l.itemId)!;
      if (!Number.isInteger(l.quantity) || l.quantity > item.quantityOrdered - item.quantityReceived) {
        return setError(`${item.productName}: quantity must be a whole number within the remaining amount`);
      }
    }
    setError(null);
    await receive.mutateAsync({ uuid: po.id, data: { items: lines, notes } });
    setQty({});
    setNotes("");
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Receive goods"
      description="Enter what actually arrived. Stock is added immediately."
      size="lg"
    >
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Remaining</th>
                <th className="px-3 py-2 w-28">Receive now</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const remaining = i.quantityOrdered - i.quantityReceived;
                return (
                  <tr key={i.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">
                      <p className="font-medium">{i.productName}</p>
                      <p className="text-xs text-neutral-500">
                        {[i.variantName, i.colorName, i.sizeName ?? i.unitName].filter(Boolean).join(" · ")} · {i.sku}
                      </p>
                    </td>
                    <td className="px-3 py-2">{remaining}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        step={1}
                        value={qty[i.id] ?? ""}
                        placeholder="0"
                        onChange={(e) => setQty((p) => ({ ...p, [i.id]: Number(e.target.value) }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Textarea
          placeholder="Notes (optional) e.g. delivery challan number"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={2}
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={submit} isLoading={receive.isPending} className={primaryBtn}>
            Confirm receipt
          </Button>
        </div>
      </div>
    </FormModal>
  );
}

export default function PurchaseOrderDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const { data: po, isLoading, error, refetch } = usePurchaseOrder(uuid);
  const { act } = usePurchaseMutations();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  if (isLoading) return <AdminTableSkeleton />;
  if (error || !po) return <ErrorState message="Failed to load purchase order" onRetry={() => refetch()} />;

  const run = (action: string, r?: string) => act.mutateAsync({ uuid, action, reason: r });
  const s = po.status;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader
        title={po.poNumber}
        description={`Vendor: ${po.vendor.name} (${po.vendor.code})`}
        breadcrumbs={
          <Link
            href="/admin/dashboard/purchase-orders"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" /> Purchase orders
          </Link>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PurchaseStatusBadge status={s} />
            {(s === "DRAFT" || s === "REJECTED") && (
              <>
                <Link href={`/admin/dashboard/purchase-orders/${uuid}/edit`}>
                  <Button variant="outline" className="h-10 rounded-xl">
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                </Link>
                <Button className={primaryBtn} isLoading={act.isPending} onClick={() => run("submit")}>
                  <Send className="mr-2 h-4 w-4" /> Submit for approval
                </Button>
              </>
            )}
            {s === "PENDING_APPROVAL" && isAdmin && (
              <>
                <Button className={primaryBtn} isLoading={act.isPending} onClick={() => run("approve")}>
                  <Check className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button variant="outline" className="h-10 rounded-xl" onClick={() => setRejectOpen(true)}>
                  <X className="mr-2 h-4 w-4" /> Reject
                </Button>
              </>
            )}
            {s === "APPROVED" && (
              <Button className={primaryBtn} isLoading={act.isPending} onClick={() => run("order")}>
                <Truck className="mr-2 h-4 w-4" /> Mark as ordered
              </Button>
            )}
            {(s === "ORDERED" || s === "PARTIALLY_RECEIVED") && (
              <Button className={primaryBtn} onClick={() => setReceiveOpen(true)}>
                <PackageCheck className="mr-2 h-4 w-4" /> Receive goods
              </Button>
            )}
            {["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ORDERED"].includes(s) && (
              <Button variant="outline" className="h-10 rounded-xl" onClick={() => setCancelOpen(true)}>
                <Ban className="mr-2 h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="mt-6 grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {s === "REJECTED" && po.rejectReason && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="font-semibold">Rejected:</span> {po.rejectReason}. Edit and resubmit.
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Ordered</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Purchase price</th>
                  <th className="px-4 py-3 text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {po.items?.map((i) => (
                  <tr key={i.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3">
                      <p className="font-medium">{i.productName}</p>
                      <p className="text-xs text-neutral-500">
                        {[i.variantName, i.colorName, i.sizeName ?? i.unitName].filter(Boolean).join(" · ")} · {i.sku}
                      </p>
                    </td>
                    <td className="px-4 py-3">{i.quantityOrdered}</td>
                    <td className="px-4 py-3">
                      <span className={i.quantityReceived >= i.quantityOrdered ? "text-green-700" : ""}>
                        {i.quantityReceived}
                      </span>
                    </td>
                    <td className="px-4 py-3">₹{i.unitCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      ₹{(i.unitCost * i.quantityOrdered).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50">
                  <td colSpan={4} className="px-4 py-2 text-right font-medium">
                    Subtotal
                  </td>
                  <td className="px-4 py-2 text-right">₹{po.subtotal.toFixed(2)}</td>
                </tr>
                <tr className="bg-neutral-50">
                  <td colSpan={4} className="px-4 py-2 text-right font-medium">
                    Additional charges
                  </td>
                  <td className="px-4 py-2 text-right">₹{po.additionalCharges.toFixed(2)}</td>
                </tr>
                <tr className="border-t border-neutral-200 bg-neutral-50">
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">₹{po.totalAmount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {!!po.receipts?.length && (
            <div className="rounded-2xl bg-white p-5">
              <h3 className="mb-3 font-semibold">Goods receipts</h3>
              <div className="space-y-3">
                {po.receipts.map((r) => (
                  <div key={r.id} className="rounded-xl border border-neutral-200 p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{r.receiptNumber}</span>
                      <span className="text-neutral-500">{fmt(r.receivedAt)}</span>
                    </div>
                    <ul className="mt-2 text-neutral-700">
                      {r.items.map((ri, idx) => (
                        <li key={idx}>
                          {ri.productName} ({ri.sku}) × {ri.quantity}
                        </li>
                      ))}
                    </ul>
                    {r.notes && <p className="mt-1 text-xs text-neutral-500">{r.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 text-sm">
            <h3 className="mb-3 font-semibold">Details</h3>
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-neutral-500">Invoice no.</dt><dd>{po.invoiceNumber ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Purchase date</dt><dd>{po.purchaseDate ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Created</dt><dd>{fmt(po.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Expected</dt><dd>{po.expectedDate ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Approved</dt><dd>{po.approvedAt ? fmt(po.approvedAt) : "—"}</dd></div>
            </dl>
            {po.notes && <p className="mt-3 border-t border-neutral-100 pt-3 text-neutral-700">{po.notes}</p>}
          </div>

          <div className="rounded-2xl bg-white p-5 text-sm">
            <h3 className="mb-3 font-semibold">History</h3>
            <ol className="space-y-3 border-l border-neutral-200 pl-4">
              {po.history?.map((h, idx) => (
                <li key={idx}>
                  <p className="font-medium">{h.toStatus.replace(/_/g, " ").toLowerCase()}</p>
                  <p className="text-xs text-neutral-500">{fmt(h.createdAt)}</p>
                  {h.note && <p className="text-xs text-neutral-600">{h.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <FormModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject purchase order"
        description="The requester can edit and resubmit."
      >
        <div className="space-y-4">
          <Textarea
            placeholder="Reason for rejection"
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
                await run("reject", reason.trim());
                setRejectOpen(false);
                setReason("");
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => {
          await run("cancel");
          setCancelOpen(false);
        }}
        title="Cancel purchase order"
        description="This cannot be undone. Nothing has been received against it yet."
        confirmText="Cancel order"
        variant="destructive"
        isLoading={act.isPending}
      />

      <ReceiveModal po={po} open={receiveOpen} onClose={() => setReceiveOpen(false)} />
    </div>
  );
}
