"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Boxes, Layers, Package, PackageX, Settings2, Warehouse } from "lucide-react";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormModal } from "@/components/common/FormModal";
import { PurchaseStatusBadge } from "@/features/purchases/components/PurchaseStatusBadge";
import { MovementTypeBadge, SignedQuantity, VariantLabel } from "@/features/inventory/components/StockBadges";
import { useInventoryDashboard, useUpdateStockSettings } from "@/features/inventory/hooks/use-stock";
import { formatDate } from "@/lib/utils";
import type { PurchaseStatus } from "@/features/purchases/types";

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  tone = "text-[var(--color-neutral-900)]",
}: {
  label: string;
  value: number;
  icon: typeof Package;
  href?: string;
  tone?: string;
}) {
  const body = (
    <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="rounded-xl bg-neutral-100 p-3">
        <Icon className={`h-5 w-5 ${tone}`} />
      </div>
      <div>
        <p className="text-sm text-neutral-500">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value.toLocaleString("en-IN")}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function InventoryDashboardPage() {
  const { data, isLoading, error, refetch } = useInventoryDashboard();
  const updateThreshold = useUpdateStockSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [threshold, setThreshold] = useState("5");

  if (error) return <ErrorState message="Failed to load inventory dashboard" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader
        title="Inventory"
        description="Your own stock, by product colour and size."
        actions={
          <>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => {
                setThreshold(String(data?.lowStockThreshold ?? 5));
                setSettingsOpen(true);
              }}
            >
              <Settings2 className="mr-2 h-4 w-4" /> Low-stock threshold
            </Button>
            <Link href="/admin/dashboard/inventory/adjustment">
              <Button className="h-11 rounded-xl bg-[var(--color-secondary-600)] text-white hover:bg-[var(--color-secondary-700)]">
                Adjust stock
              </Button>
            </Link>
          </>
        }
      />

      <AdminContent className="gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {isLoading || !data ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          ) : (
            <>
              <StatCard label="Total products" value={data.totalProducts} icon={Package} />
              <StatCard
                label="Total variants"
                value={data.totalVariants}
                icon={Layers}
                href="/admin/dashboard/inventory/stock"
              />
              <StatCard label="Available stock" value={data.totalAvailableStock} icon={Boxes} />
              <StatCard
                label={`Low stock (≤ ${data.lowStockThreshold})`}
                value={data.lowStockItems}
                icon={AlertTriangle}
                tone="text-yellow-600"
                href="/admin/dashboard/inventory/stock?status=low_stock"
              />
              <StatCard
                label="Out of stock"
                value={data.outOfStockItems}
                icon={PackageX}
                tone="text-red-600"
                href="/admin/dashboard/inventory/stock?status=out_of_stock"
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Recent purchases</h2>
              <Link href="/admin/dashboard/purchase-orders" className="text-sm text-secondary-600 hover:underline">
                View all
              </Link>
            </div>
            {isLoading || !data ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : data.recentPurchases.length === 0 ? (
              <EmptyState
                title="No purchases yet"
                description="Purchases you record from vendors will show up here."
                icon={<Warehouse className="h-8 w-8 text-muted-foreground" />}
              />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {data.recentPurchases.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/admin/dashboard/purchase-orders/${p.id}`}
                      className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-neutral-50"
                    >
                      <div>
                        <p className="font-medium">{p.poNumber}</p>
                        <p className="text-xs text-neutral-500">
                          {p.vendorName} · {formatDate(p.purchaseDate)} · {p.itemCount} item
                          {p.itemCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium tabular-nums">₹{p.totalAmount.toLocaleString("en-IN")}</span>
                        <PurchaseStatusBadge status={p.status as PurchaseStatus} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Recent stock movements</h2>
              <Link href="/admin/dashboard/inventory/movements" className="text-sm text-secondary-600 hover:underline">
                View all
              </Link>
            </div>
            {isLoading || !data ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : data.recentMovements.length === 0 ? (
              <EmptyState title="No stock movements yet" description="Every stock change is recorded here." />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {data.recentMovements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <VariantLabel item={m} />
                    <div className="flex shrink-0 items-center gap-3">
                      <MovementTypeBadge type={m.movementType} />
                      <SignedQuantity value={m.signedQuantity} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </AdminContent>

      <FormModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Low-stock threshold"
        description="Items with available stock at or below this number are flagged as low stock."
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const n = Number(threshold);
            if (!Number.isInteger(n) || n < 0) return;
            await updateThreshold.mutateAsync(n);
            setSettingsOpen(false);
          }}
        >
          <Input type="number" min={0} step={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          <p className="text-xs text-neutral-500">A colour/size with its own reorder level uses that level instead.</p>
          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={updateThreshold.isPending}
              className="rounded-xl bg-[var(--color-secondary-600)] text-white"
            >
              Save
            </Button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
