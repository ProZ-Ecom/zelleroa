"use client";

import { formatPrice } from "@/lib/utils";

interface Props {
  customers: { id: string; name: string; email: string | null; orders: number; spent: number }[];
}

const AVATARS = [
  ["var(--primary-500)", "var(--primary-700)"],
  ["var(--success-500)", "var(--success-700)"],
  ["var(--yellow-400)", "var(--yellow-600)"],
  ["var(--error-400)", "var(--error-600)"],
  ["var(--neutral-500)", "var(--neutral-700)"],
];

function TopCustomers({ customers }: Props) {
  const max = Math.max(...customers.map((c) => c.spent), 1);

  return (
    <div className="rounded-2xl border border-[var(--color-neutral-200)]/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <h3 className="mb-5 text-base font-semibold text-[var(--color-neutral-900)]">
        Top Customers
      </h3>
      {customers.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--color-neutral-400)]">No data yet</p>
      ) : (
        <ul className="space-y-4">
          {customers.map((c, i) => {
            const [from, to] = AVATARS[i % AVATARS.length];
            return (
              <li key={c.id} className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                  style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
                >
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium text-[var(--color-neutral-900)]">
                      {c.name}
                    </p>
                    <span className="flex-shrink-0 text-sm font-semibold text-[var(--color-neutral-900)] tabular-nums">
                      {formatPrice(c.spent)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max((c.spent / max) * 100, 4)}%`,
                          backgroundImage: `linear-gradient(90deg, ${from}, ${to})`,
                        }}
                      />
                    </div>
                    <span className="w-16 flex-shrink-0 text-right text-xs text-[var(--color-neutral-500)]">
                      {c.orders} {c.orders === 1 ? "order" : "orders"}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { TopCustomers };
