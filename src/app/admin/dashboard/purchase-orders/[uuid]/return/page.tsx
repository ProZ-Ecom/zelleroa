"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/Toast";
import { useReturnableItems, usePurchaseReturnMutations } from "@/features/purchases/hooks";
import { returnReasonOptions } from "@/features/purchases/components/PurchaseReturnBadges";
import type { PurchaseReturnReason, PurchaseReturnResponse } from "@/features/purchases/types";

const money = (n: number) => `₹${n.toFixed(2)}`;
const labelCls = "mb-1.5 block text-sm font-medium text-neutral-700";

interface Line {
  quantity: string;
  reason: PurchaseReturnReason;
  notes: string;
}

export default function NewPurchaseReturnPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const router = useRouter();
  const { data: order, isLoading, error, refetch } = useReturnableItems(uuid);
  const { create } = usePurchaseReturnMutations();

  const [lines, setLines] = useState<Record<number, Line>>({});
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [debitNoteNumber, setDebitNoteNumber] = useState("");
  const [notes, setNotes] = useState("");

  const blankLine: Line = { quantity: "", reason: "DAMAGED", notes: "" };
  const set = (id: number, patch: Partial<Line>) =>
    setLines((prev) => ({ ...prev, [id]: { ...blankLine, ...prev[id], ...patch } }));

  const chosen = useMemo(() => {
    if (!order) return [];
    return order.items
      .map((item) => ({ item, line: lines[item.purchaseOrderItemId] }))
      .filter((r) => r.line && Number(r.line.quantity) > 0);
  }, [order, lines]);

  const total = chosen.reduce((sum, r) => sum + Number(r.line!.quantity) * r.item.unitCost, 0);

  if (isLoading) return <AdminTableSkeleton />;
  if (error || !order)
    return <ErrorState message="Failed to load the purchase order" onRetry={() => refetch()} />;

  const submit = async () => {
    for (const { item, line } of chosen) {
      const qty = Number(line!.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > item.returnable) {
        return toast.error(`${item.sku}: enter a whole number between 1 and ${item.returnable}`);
      }
    }
    if (chosen.length === 0) return toast.error("Enter a quantity for at least one item");

    const res = (await create.mutateAsync({
      purchaseOrderId: order.id,
      returnDate,
      debitNoteNumber: debitNoteNumber.trim() || null,
      notes: notes.trim() || null,
      items: chosen.map(({ item, line }) => ({
        purchaseOrderItemId: item.purchaseOrderItemId,
        quantity: Number(line!.quantity),
        reason: line!.reason,
        notes: line!.notes.trim() || null,
      })),
    })) as { data?: PurchaseReturnResponse };
    router.push(`/admin/dashboard/purchase-returns/${res.data?.id ?? ""}`);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader
        title={`Return against ${order.poNumber}`}
        description={`${order.vendor.name} (${order.vendor.code})${order.invoiceNumber ? ` · Invoice ${order.invoiceNumber}` : ""}`}
        breadcrumbs={
          <Link
            href={`/admin/dashboard/purchase-orders/${uuid}`}
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" /> {order.poNumber}
          </Link>
        }
      />

      {order.items.length === 0 ? (
        <div className="mt-6 max-w-5xl">
          <EmptyState
            title="Nothing left to return"
            description="Every unit received on this purchase has already been returned, or is on an open return."
          />
        </div>
      ) : (
        <div className="mt-6 max-w-6xl space-y-6">
          <div className="space-y-5 rounded-2xl bg-white p-6">
            <p className="text-sm font-semibold text-neutral-900">Return details</p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <label className={labelCls}>Return date</label>
                <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Vendor debit note no.</label>
                <Input
                  value={debitNoteNumber}
                  maxLength={60}
                  placeholder="Optional"
                  onChange={(e) => setDebitNoteNumber(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <Input
                  value={notes}
                  maxLength={500}
                  placeholder="e.g. courier docket number"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">In stock</th>
                  <th className="px-4 py-3">Returnable</th>
                  <th className="px-4 py-3 w-28">Return qty</th>
                  <th className="px-4 py-3 w-44">Reason</th>
                  <th className="px-4 py-3 w-52">Note</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => {
                  const line = lines[item.purchaseOrderItemId];
                  return (
                    <tr key={item.purchaseOrderItemId} className="border-t border-neutral-100">
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-neutral-500">
                          {[item.variantName, item.colorName, item.sizeName ?? item.unitName]
                            .filter(Boolean)
                            .join(" · ")}{" "}
                          · {item.sku}
                        </p>
                      </td>
                      <td className="px-4 py-3">{item.quantityReceived}</td>
                      <td className="px-4 py-3">
                        <span className={item.currentStock < item.returnable ? "text-amber-600" : ""}>
                          {item.currentStock}
                        </span>
                      </td>
                      <td className="px-4 py-3">{item.returnable}</td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min={0}
                          max={item.returnable}
                          step={1}
                          value={line?.quantity ?? ""}
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => set(item.purchaseOrderItemId, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={line?.reason ?? "DAMAGED"}
                          onValueChange={(val) =>
                            set(item.purchaseOrderItemId, { reason: val as PurchaseReturnReason })
                          }
                          options={returnReasonOptions}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={line?.notes ?? ""}
                          maxLength={255}
                          placeholder="Optional"
                          onChange={(e) => set(item.purchaseOrderItemId, { notes: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6">
            <div>
              <p className="text-sm text-neutral-500">
                {chosen.length} item(s) ·{" "}
                {chosen.reduce((n, r) => n + Number(r.line!.quantity), 0)} unit(s)
              </p>
              <p className="text-lg font-semibold">Debit note value {money(total)}</p>
            </div>
            <Button
              onClick={submit}
              isLoading={create.isPending}
              disabled={chosen.length === 0}
              className="h-11 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-5 text-sm font-semibold text-white"
            >
              Create return draft
            </Button>
          </div>
          <p className="pb-6 text-sm text-neutral-500">
            This saves a draft. Stock only moves when you complete the return.
          </p>
        </div>
      )}
    </div>
  );
}
