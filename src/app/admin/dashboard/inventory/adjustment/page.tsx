"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Minus, Plus, Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MovementTypeBadge, SignedQuantity, VariantLabel } from "@/features/inventory/components/StockBadges";
import {
  useAdjustStockLevel,
  useCurrentStock,
  useStockMovements,
} from "@/features/inventory/hooks/use-stock";
import { usePurchaseProducts } from "@/features/purchases/hooks";
import { cn, formatDateTime } from "@/lib/utils";
import type { MovementRow } from "@/features/inventory/types/stock";

const REASONS = ["Damaged items", "Stock count correction", "Lost / missing", "Found extra stock"];
const labelCls = "mb-1.5 block text-sm font-medium text-neutral-700";

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const historyColumns: ColumnDef<MovementRow>[] = [
  { id: "date", header: "Date", cell: ({ row }) => <span className="text-sm">{formatDateTime(row.original.createdAt)}</span> },
  { id: "product", header: "Product", cell: ({ row }) => <VariantLabel item={row.original} /> },
  { id: "type", header: "Type", cell: ({ row }) => <MovementTypeBadge type={row.original.movementType} /> },
  { id: "qty", header: "Change", cell: ({ row }) => <SignedQuantity value={row.original.signedQuantity} /> },
  {
    id: "stock",
    header: "Stock",
    cell: ({ row }) =>
      row.original.previousStock === null ? "—" : `${row.original.previousStock} → ${row.original.newStock}`,
  },
  { id: "reason", header: "Reason", cell: ({ row }) => <span className="text-sm">{row.original.reason ?? "—"}</span> },
  { id: "by", header: "By", cell: ({ row }) => <span className="text-sm">{row.original.createdBy ?? "—"}</span> },
];

function AdjustmentContent() {
  const searchParams = useSearchParams();
  const preselect = Number(searchParams.get("item"));
  const [selectedId, setSelectedId] = useState<number | null>(
    Number.isInteger(preselect) && preselect > 0 ? preselect : null
  );
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ item?: string; quantity?: string; reason?: string }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const debounced = useDebounced(search);
  const { data: options = [], isFetching } = usePurchaseProducts(debounced);
  const { data: selectedRows } = useCurrentStock({
    variantUnitPriceId: selectedId ?? undefined,
    limit: 1,
  });
  const selected = selectedId ? selectedRows?.data?.[0] : undefined;
  const adjust = useAdjustStockLevel();
  const [historyPage, setHistoryPage] = useState(1);
  const history = useStockMovements({ type: "ADJUSTMENT", page: historyPage, limit: 10 });

  const qty = Number(quantity);
  const validQty = Number.isInteger(qty) && qty > 0;
  const projected = selected && validQty ? selected.available + (direction === "in" ? qty : -qty) : null;

  const validate = () => {
    const next: typeof errors = {};
    if (!selectedId) next.item = "Select a product";
    if (!validQty) next.quantity = "Enter a whole number of at least 1";
    else if (direction === "out" && selected && qty > selected.available)
      next.quantity = `Only ${selected.available} in stock - cannot remove ${qty}`;
    if (reason.trim().length < 3) next.reason = "A reason is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!selectedId) return;
    await adjust.mutateAsync({ variantUnitPriceId: selectedId, direction, quantity: qty, reason: reason.trim() });
    setConfirmOpen(false);
    setQuantity("");
    setReason("");
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader
        title="Stock Adjustment"
        description="Correct stock for damage, loss or count differences. Every adjustment is logged."
      />

      <div className="mt-6 grid max-w-5xl grid-cols-1 gap-6 rounded-2xl bg-white p-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Product (colour / size) *</label>
            {selected ? (
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
                <VariantLabel item={selected} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedId(null);
                    setQuantity("");
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  className="pl-9"
                  placeholder="Search by product name or SKU..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                />
                {showResults && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
                    {options.length === 0 && (
                      <p className="px-4 py-3 text-sm text-neutral-500">
                        {isFetching ? "Searching..." : "No products found"}
                      </p>
                    )}
                    {options.map((o) => (
                      <button
                        type="button"
                        key={o.variantUnitPriceId}
                        onClick={() => {
                          setSelectedId(o.variantUnitPriceId);
                          setShowResults(false);
                          setSearch("");
                          setErrors((e) => ({ ...e, item: undefined }));
                        }}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-neutral-50"
                      >
                        <span>
                          <span className="font-medium text-neutral-900">{o.label}</span>
                          <span className="ml-2 text-xs text-neutral-500">{o.sku}</span>
                        </span>
                        <span className="text-xs text-neutral-500">Stock {o.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.item && <p className="mt-1 text-sm text-red-600">{errors.item}</p>}
          </div>

          {selected && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Current stock</p>
                <p className="text-xl font-bold tabular-nums">{selected.available}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Adjustment</p>
                <p className="text-xl font-bold tabular-nums">
                  {validQty ? <SignedQuantity value={direction === "in" ? qty : -qty} /> : "—"}
                </p>
              </div>
              <div className={cn("rounded-xl p-3", projected !== null && projected < 0 ? "bg-red-50" : "bg-neutral-50")}>
                <p className="text-xs text-neutral-500">New stock</p>
                <p className="text-xl font-bold tabular-nums">{projected ?? "—"}</p>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Adjustment *</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["out", "Decrease", Minus],
                  ["in", "Increase", Plus],
                ] as const
              ).map(([value, text, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDirection(value)}
                  className={cn(
                    "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors",
                    direction === value
                      ? "border-secondary-600 bg-secondary-50 text-secondary-700"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  )}
                  aria-pressed={direction === value}
                >
                  <Icon className="h-4 w-4" /> {text}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Quantity *</label>
            <Input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 2"
            />
            {errors.quantity && <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>}
          </div>

          <div>
            <label className={labelCls}>Reason *</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  {r}
                </button>
              ))}
            </div>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} rows={2} />
            {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => validate() && setConfirmOpen(true)}
              className="h-11 rounded-xl bg-[var(--color-secondary-600)] px-6 text-sm font-semibold text-white hover:bg-[var(--color-secondary-700)]"
            >
              Review adjustment
            </Button>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-50 p-5 text-sm text-neutral-600">
          <h3 className="mb-2 font-semibold text-neutral-800">How adjustments work</h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Use this only for stock that did not come from a purchase, sale or return.</li>
            <li>Stock can never go below zero.</li>
            <li>
              Each adjustment is recorded in{" "}
              <Link href="/admin/dashboard/inventory/movements" className="text-secondary-600 hover:underline">
                Stock Movements
              </Link>{" "}
              with who made it and why.
            </li>
          </ul>
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Recent adjustments</h2>
      <div className="max-w-5xl pb-6">
        {history.isLoading && !history.data ? (
          <AdminTableSkeleton />
        ) : (
          <DataTable
            columns={historyColumns}
            data={history.data?.data ?? []}
            emptyMessage="No adjustments yet"
            pageSize={10}
            page={history.data?.meta?.page ?? historyPage}
            totalPages={history.data?.meta?.totalPages ?? 1}
            totalItems={history.data?.meta?.total ?? 0}
            onPageChange={setHistoryPage}
            className="bg-white"
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
        title="Confirm stock adjustment"
        description={
          selected
            ? `${selected.productName} (${[selected.colorName, selected.sizeName].filter(Boolean).join(" / ") || selected.sku}): ${selected.available} → ${projected}. Reason: ${reason.trim()}`
            : ""
        }
        confirmText="Apply adjustment"
        variant={direction === "out" ? "destructive" : "default"}
        isLoading={adjust.isPending}
      />
    </div>
  );
}

export default function StockAdjustmentPage() {
  return (
    <Suspense fallback={<AdminTableSkeleton />}>
      <AdjustmentContent />
    </Suspense>
  );
}
