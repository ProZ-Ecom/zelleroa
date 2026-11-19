"use client";

import { formatPrice } from "@/lib/utils";

interface DummyProduct {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

interface TopProductsProps {
  products: DummyProduct[];
}

const RANK_STYLES = [
  "linear-gradient(135deg, var(--yellow-400), var(--yellow-600))",
  "linear-gradient(135deg, var(--neutral-400), var(--neutral-600))",
  "linear-gradient(135deg, #d6915a, #a8622f)",
];

function TopProducts({ products }: TopProductsProps) {
  const maxRevenue = Math.max(...products.map((p) => p.revenue), 1);

  return (
    <div className="rounded-2xl border border-[var(--color-neutral-200)]/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--color-neutral-900)]">
          Top Selling Products
        </h3>
      </div>

      {products.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--color-neutral-400)]">Nothing to show</p>
      )}
      <ul className="space-y-4">
        {products.map((product, index) => (
          <li key={product.id} className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                index < 3 ? "text-white shadow-sm" : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]"
              }`}
              style={index < 3 ? { backgroundImage: RANK_STYLES[index] } : undefined}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium text-[var(--color-neutral-900)]">
                  {product.name}
                </p>
                <span className="flex-shrink-0 text-sm font-semibold text-[var(--color-neutral-900)] tabular-nums">
                  {formatPrice(product.revenue)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((product.revenue / maxRevenue) * 100, 4)}%`,
                      backgroundImage:
                        "linear-gradient(90deg, var(--primary-400), var(--primary-600))",
                    }}
                  />
                </div>
                <span className="w-14 flex-shrink-0 text-right text-xs text-[var(--color-neutral-500)]">
                  {product.unitsSold} sold
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { TopProducts };
export type { DummyProduct };
