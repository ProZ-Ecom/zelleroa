"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  Layers,
  Lock,
  Package,
  PackageX,
  Palette,
  Settings2,
  Tags,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormModal } from "@/components/common/FormModal";
import { PurchaseStatusBadge } from "@/features/purchases/components/PurchaseStatusBadge";
import {
  MovementTypeBadge,
  SignedQuantity,
  StockStatusBadge,
  VariantLabel,
} from "@/features/inventory/components/StockBadges";
import { useInventoryDashboard, useUpdateStockSettings } from "@/features/inventory/hooks/use-stock";
import { formatDate } from "@/lib/utils";
import type { PurchaseStatus } from "@/features/purchases/types";

const units = (n: number) => n.toLocaleString("en-IN");
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const quickLinks = [
  { href: "/admin/dashboard/inventory/stock", label: "Current stock", icon: Layers },
  { href: "/admin/dashboard/inventory/movements", label: "Stock movements", icon: TrendingUp },
  { href: "/admin/dashboard/inventory/pricing", label: "Pricing", icon: Tags },
  {
    href: "/admin/dashboard/inventory/valuation",
    label: "Valuation & margin",
    icon: CircleDollarSign,
  },
  { href: "/admin/dashboard/purchase-orders", label: "Purchase orders", icon: Warehouse },
];

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
  tone = "text-[var(--color-neutral-900)]",
}: {
  label: string;
  value: string;
  icon: typeof Package;
  href?: string;
  hint?: string;
  tone?: string;
}) {
  const body = (
    <div className="flex h-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="rounded-xl bg-neutral-100 p-3">
        <Icon className={`h-5 w-5 ${tone}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-neutral-500">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function RowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

/** One segment per stock status, so the split reads at a glance. */
function StockHealthBar({
  inStock,
  lowStock,
  outOfStock,
}: {
  inStock: number;
  lowStock: number;
  outOfStock: number;
}) {
  const total = inStock + lowStock + outOfStock;
  const segments = [
    { label: "In stock", value: inStock, color: "bg-emerald-500", status: "in_stock" },
    { label: "Low stock", value: lowStock, color: "bg-amber-500", status: "low_stock" },
    { label: "Out of stock", value: outOfStock, color: "bg-red-500", status: "out_of_stock" },
  ];
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
        {segments.map((s) => (
          <div
            key={s.label}
            className={s.color}
            style={{ width: `${pct(s.value)}%` }}
            title={`${s.label}: ${units(s.value)}`}
          />
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {segments.map((s) => (
          <Link
            key={s.label}
            href={`/admin/dashboard/inventory/stock?status=${s.status}`}
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <span className={`h-2 w-2 rounded-full ${s.color}`} />
            <span className="text-neutral-600">{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{units(s.value)}</span>
            <span className="w-10 text-right text-xs text-neutral-400 tabular-nums">
              {pct(s.value).toFixed(0)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function InventoryDashboardPage() {
  const { data, isLoading, error, refetch } = useInventoryDashboard();
  const updateThreshold = useUpdateStockSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [threshold, setThreshold] = useState("5");

  if (error)
    return <ErrorState message="Failed to load inventory dashboard" onRetry={() => refetch()} />;

  const loading = isLoading || !data;
  const topCategoryValue = data?.topCategories[0]?.costValue ?? 0;

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
              <Button className="h-11 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-5 text-sm font-semibold text-white transition-colors">
                Adjust stock
              </Button>
            </Link>
          </>
        }
      />

      <AdminContent className="gap-6">
        <div className="flex flex-wrap gap-2">
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))
          ) : (
            <>
              <StatCard label="Total products" value={units(data.totalProducts)} icon={Package} />
              <StatCard
                label="Colour / size SKUs"
                value={units(data.totalVariants)}
                icon={Palette}
                href="/admin/dashboard/inventory/stock"
              />
              <StatCard
                label="Available stock"
                value={units(data.totalAvailableStock)}
                icon={Boxes}
                hint="Units free to sell"
              />
              <StatCard
                label="Reserved stock"
                value={units(data.totalReservedStock)}
                icon={Lock}
                hint="Held for orders not yet shipped"
              />
              <StatCard
                label={`Low stock (≤ ${data.lowStockThreshold})`}
                value={units(data.lowStockItems)}
                icon={AlertTriangle}
                tone="text-yellow-600"
                href="/admin/dashboard/inventory/stock?status=low_stock"
              />
              <StatCard
                label="Out of stock"
                value={units(data.outOfStockItems)}
                icon={PackageX}
                tone="text-red-600"
                href="/admin/dashboard/inventory/stock?status=out_of_stock"
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <SectionCard
            title="Stock on hand, in money"
            className="xl:col-span-2"
            action={
              <Link
                href="/admin/dashboard/inventory/valuation"
                className="text-sm text-secondary-600 hover:underline"
              >
                Full report
              </Link>
            }
          >
            {loading ? (
              <RowSkeleton rows={2} />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-neutral-200 px-4 py-3">
                    <p className="text-xs font-medium text-neutral-500">Value at cost</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {money(data.stockValue.costValue)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 px-4 py-3">
                    <p className="text-xs font-medium text-neutral-500">Value at retail</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {money(data.stockValue.retailValue)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 px-4 py-3">
                    <p className="text-xs font-medium text-neutral-500">Potential profit</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600">
                      {money(data.stockValue.potentialProfit)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-400">
                      {data.stockValue.marginPercent === null
                        ? "Margin not known"
                        : `${data.stockValue.marginPercent.toFixed(1)}% margin`}
                    </p>
                  </div>
                </div>
                {data.stockValue.unvaluedSkus > 0 && (
                  <p className="mt-3 flex items-start gap-2 text-xs text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {units(data.stockValue.unvaluedSkus)} SKU
                    {data.stockValue.unvaluedSkus === 1 ? " has" : "s have"} no cost on record, so
                    they are left out of these figures.
                  </p>
                )}
              </>
            )}
          </SectionCard>

          <SectionCard title="Stock health">
            {loading ? (
              <RowSkeleton rows={3} />
            ) : (
              <StockHealthBar
                inStock={data.inStockItems}
                lowStock={data.lowStockItems}
                outOfStock={data.outOfStockItems}
              />
            )}
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            title="Needs reordering"
            action={
              <Link
                href="/admin/dashboard/inventory/stock?status=low_stock"
                className="text-sm text-secondary-600 hover:underline"
              >
                {!loading && data.reorderCount > data.needsReorder.length
                  ? `View all ${units(data.reorderCount)}`
                  : "View all"}
              </Link>
            }
          >
            {loading ? (
              <RowSkeleton />
            ) : data.needsReorder.length === 0 ? (
              <EmptyState
                title="Everything is stocked"
                description="No colour or size is at or below its reorder level."
              />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {data.needsReorder.map((r) => (
                  <li key={r.variantUnitPriceId}>
                    <Link
                      href={`/admin/dashboard/inventory/adjustment?item=${r.variantUnitPriceId}`}
                      className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-neutral-50"
                    >
                      <VariantLabel item={r} />
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-neutral-500 tabular-nums">
                          {units(r.available)} / {units(r.threshold)}
                        </span>
                        <StockStatusBadge status={r.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title={loading ? "Movement summary" : `Movements, last ${data.windowDays} days`}
            action={
              <Link
                href="/admin/dashboard/inventory/movements"
                className="text-sm text-secondary-600 hover:underline"
              >
                View all
              </Link>
            }
          >
            {loading ? (
              <RowSkeleton />
            ) : data.movementSummary.length === 0 ? (
              <EmptyState
                title="No movements in this period"
                description="Purchases, sales and adjustments are summed up here."
              />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {data.movementSummary.map((m) => (
                  <li
                    key={m.movementType ?? "legacy"}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <MovementTypeBadge type={m.movementType} />
                      <span className="text-xs text-neutral-500">
                        {units(m.movements)} entr{m.movements === 1 ? "y" : "ies"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 tabular-nums">
                      <span className="flex items-center gap-1 text-green-700">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {units(m.unitsIn)}
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <ArrowDownRight className="h-3.5 w-3.5" />
                        {units(m.unitsOut)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Stock value by category"
            action={
              <Link
                href="/admin/dashboard/inventory/valuation"
                className="text-sm text-secondary-600 hover:underline"
              >
                View all
              </Link>
            }
          >
            {loading ? (
              <RowSkeleton />
            ) : data.topCategories.length === 0 ? (
              <EmptyState
                title="Nothing to value yet"
                description="Record a purchase to give stock a cost."
              />
            ) : (
              <ul className="space-y-3">
                {data.topCategories.map((c) => (
                  <li key={c.key || c.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {money(c.costValue)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-theme-primary"
                        style={{
                          width: `${
                            topCategoryValue > 0
                              ? Math.max(2, (c.costValue / topCategoryValue) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-400 tabular-nums">
                      {units(c.units)} units · {units(c.skuCount)} SKU
                      {c.skuCount === 1 ? "" : "s"} · {money(c.retailValue)} at retail
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Recent purchases"
            action={
              <Link
                href="/admin/dashboard/purchase-orders"
                className="text-sm text-secondary-600 hover:underline"
              >
                View all
              </Link>
            }
          >
            {loading ? (
              <RowSkeleton />
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
                        <span className="font-medium tabular-nums">
                          {money(p.totalAmount)}
                        </span>
                        <PurchaseStatusBadge status={p.status as PurchaseStatus} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Recent stock movements"
            className="xl:col-span-2"
            action={
              <Link
                href="/admin/dashboard/inventory/movements"
                className="text-sm text-secondary-600 hover:underline"
              >
                View all
              </Link>
            }
          >
            {loading ? (
              <RowSkeleton />
            ) : data.recentMovements.length === 0 ? (
              <EmptyState
                title="No stock movements yet"
                description="Every stock change is recorded here."
              />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {data.recentMovements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <VariantLabel item={m} />
                    <div className="flex shrink-0 items-center gap-3">
                      {m.createdBy && (
                        <span className="hidden text-xs text-neutral-400 lg:inline">
                          {m.createdBy}
                        </span>
                      )}
                      <span className="hidden text-xs text-neutral-500 sm:inline">
                        {formatDate(m.createdAt)}
                      </span>
                      {m.newStock !== null && (
                        <span className="hidden text-xs text-neutral-500 tabular-nums md:inline">
                          {m.previousStock ?? 0} → {m.newStock}
                        </span>
                      )}
                      <MovementTypeBadge type={m.movementType} />
                      <SignedQuantity value={m.signedQuantity} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
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
          <Input
            type="number"
            min={0}
            step={1}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
          <p className="text-xs text-neutral-500">
            A colour/size with its own reorder level uses that level instead.
          </p>
          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={updateThreshold.isPending}
              className="rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-white transition-colors"
            >
              Save
            </Button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
