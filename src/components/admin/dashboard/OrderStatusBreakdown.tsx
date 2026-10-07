"use client";

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--yellow-500)",
  confirmed: "var(--color-primary-300)",
  processing: "var(--color-primary-400)",
  packed: "var(--color-primary-500)",
  shipped: "var(--color-primary-600)",
  out_for_delivery: "var(--color-primary-800)",
  delivered: "var(--color-success-500)",
  cancelled: "var(--color-error-500)",
  returned: "var(--color-neutral-500)",
};

interface Props {
  statuses: { status: string; count: number }[];
  periodLabel?: string;
}

const R = 52;
const C = 2 * Math.PI * R;

function OrderStatusBreakdown({ statuses, periodLabel = "in period" }: Props) {
  const total = statuses.reduce((s, x) => s + x.count, 0);
  const sorted = [...statuses].sort((a, b) => b.count - a.count);

  const arcs = sorted.map((s, i) => ({
    ...s,
    len: (s.count / total) * C,
    offset: (sorted.slice(0, i).reduce((sum, x) => sum + x.count, 0) / total) * C,
  }));

  return (
    <div className="h-full rounded-2xl border border-[var(--color-neutral-200)]/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <h3 className="text-base font-semibold text-[var(--color-neutral-900)]">Orders by Status</h3>
      <p className="mb-4 text-sm text-[var(--color-neutral-500)]">{periodLabel}</p>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-neutral-400)]">
          No orders in this period
        </p>
      ) : (
        <>
          <div className="relative mx-auto mb-5 h-44 w-44">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label="Order status donut chart">
              <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-neutral-100)" strokeWidth="18" />
              {arcs.map((a) => (
                <circle
                  key={a.status}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={STATUS_COLORS[a.status] ?? "var(--color-neutral-400)"}
                  strokeWidth="18"
                  strokeDasharray={`${a.len} ${C - a.len}`}
                  strokeDashoffset={-a.offset}
                >
                  <title>{`${a.status.replace(/_/g, " ")}: ${a.count}`}</title>
                </circle>
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[var(--color-neutral-900)]">{total}</span>
              <span className="text-xs text-[var(--color-neutral-500)]">orders</span>
            </div>
          </div>
          <ul className="space-y-2">
            {sorted.map((s) => (
              <li key={s.status} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: STATUS_COLORS[s.status] ?? "var(--color-neutral-400)" }}
                />
                <span className="flex-1 capitalize text-[var(--color-neutral-700)]">
                  {s.status.replace(/_/g, " ")}
                </span>
                <span className="font-medium text-[var(--color-neutral-900)]">{s.count}</span>
                <span className="w-10 text-right text-xs text-[var(--color-neutral-500)]">
                  {Math.round((s.count / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export { OrderStatusBreakdown };
