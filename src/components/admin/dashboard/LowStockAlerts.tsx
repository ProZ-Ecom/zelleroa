"use client";

import { AlertTriangle, PackageX } from "lucide-react";

interface DummyLowStockItem {
  id: string;
  name: string;
  variant?: string | null;
  sku: string;
  stock: number;
  reorderLevel: number;
}

interface LowStockAlertsProps {
  items: DummyLowStockItem[];
}

function LowStockAlerts({ items }: LowStockAlertsProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-neutral-200)]/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--color-neutral-900)]">
          Low Stock Alerts
        </h3>
        {items.length > 0 && (
          <span className="rounded-full bg-[var(--color-error-50)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-error-700)]">
            {items.length} items
          </span>
        )}
      </div>

      {items.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--color-neutral-400)]">
          All items are well stocked
        </p>
      )}
      <ul className="grid gap-x-8 gap-y-4 xl:grid-cols-2">
        {items.map((item) => {
          const out = item.stock <= 0;
          const pct =
            item.reorderLevel > 0 ? Math.min((item.stock / item.reorderLevel) * 100, 100) : 0;
          const Icon = out ? PackageX : AlertTriangle;
          return (
            <li key={item.id} className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  out
                    ? "bg-[var(--color-error-50)] text-[var(--color-error-600)]"
                    : "bg-yellow-50 text-yellow-600"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-[var(--color-neutral-900)]">
                    {item.name}
                    {item.variant && (
                      <span className="font-normal text-[var(--color-neutral-500)]">
                        {" "}
                        &middot; {item.variant}
                      </span>
                    )}
                  </p>
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      out
                        ? "bg-[var(--color-error-50)] text-[var(--color-error-700)]"
                        : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {out ? "Out of stock" : `${item.stock} left`}
                  </span>
                </div>
                <p className="truncate text-xs text-[var(--color-neutral-500)]">
                  {item.sku} &middot; reorder at {item.reorderLevel}
                </p>
                {item.reorderLevel > 0 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(pct, out ? 0 : 4)}%`,
                        background: out ? "var(--error-500)" : "var(--yellow-500)",
                      }}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { LowStockAlerts };
export type { DummyLowStockItem };
