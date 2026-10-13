import Link from "next/link";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { COMMISSION_STATUS_LABELS, PAYOUT_STATUS_LABELS } from "../constants";

const STATUS_STYLES: Record<string, string> = {
  // commission
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  pending_approval: "bg-violet-50 text-violet-700 border-violet-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  payout_requested: "bg-sky-50 text-sky-700 border-sky-200",
  payout_approved: "bg-indigo-50 text-indigo-700 border-indigo-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-neutral-100 text-neutral-600 border-neutral-200",
  reversed: "bg-red-50 text-red-700 border-red-200",
  // payout
  requested: "bg-sky-50 text-sky-700 border-sky-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  // account
  blocked: "bg-red-50 text-red-700 border-red-200",
  // order
  confirmed: "bg-sky-50 text-sky-700 border-sky-200",
  processing: "bg-sky-50 text-sky-700 border-sky-200",
  packed: "bg-sky-50 text-sky-700 border-sky-200",
  shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
  out_for_delivery: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  returned: "bg-red-50 text-red-700 border-red-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-neutral-100 text-neutral-600 border-neutral-200",
  ended: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

export function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return COMMISSION_STATUS_LABELS[value] ?? PAYOUT_STATUS_LABELS[value] ?? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <span className="text-neutral-400">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-700 border-neutral-200",
        className
      )}
    >
      {humanize(status)}
    </span>
  );
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
export const money = (n: number | null | undefined) => (n == null ? "—" : inr.format(n));
export const pct = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);
export const dateOnly = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const dateTime = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-bold tracking-tight text-neutral-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const TONE_STYLES = {
  default: { icon: "bg-neutral-100 text-neutral-700", value: "text-neutral-900", bar: "bg-neutral-300" },
  good: { icon: "bg-emerald-50 text-emerald-600", value: "text-emerald-700", bar: "bg-emerald-400" },
  warn: { icon: "bg-amber-50 text-amber-600", value: "text-amber-700", bar: "bg-amber-400" },
} as const;

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md">
      <span className={cn("absolute inset-x-0 top-0 h-0.5", t.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", t.icon)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={cn("mt-2 text-xl font-bold tracking-tight sm:text-2xl", t.value)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Pin this column to the right edge while the table scrolls horizontally. */
  stickyRight?: boolean;
}

const STICKY_RIGHT = "sticky right-0 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]";

/** Plain responsive table: scrolls horizontally on small screens instead of breaking layout. */
export function SimpleTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing to show yet.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          <Inbox className="h-5 w-5" />
        </span>
        <p className="max-w-xs text-sm text-neutral-500">{empty}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500">
            {columns.map((c, i) => (
              <th key={`${i}-${c.header}`} className={cn("px-4 py-2.5 font-semibold", c.stickyRight && cn(STICKY_RIGHT, "z-10 bg-neutral-50"), c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="group border-b border-neutral-100 last:border-0 transition-colors hover:bg-neutral-50">
              {columns.map((c, i) => (
                <td key={`${i}-${c.header}`} className={cn("px-4 py-3 align-middle text-neutral-800", c.stickyRight && cn(STICKY_RIGHT, "z-10 bg-white transition-colors group-hover:bg-neutral-50"), c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pagination via plain links (server-rendered pages). */
export function LinkPager({
  basePath,
  params,
  page,
  totalPages,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total: number;
}) {
  if (totalPages <= 1) {
    return total > 0 ? <p className="px-5 py-3 text-xs text-neutral-500">{total} record(s)</p> : null;
  }
  const href = (p: number) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
    search.set("page", String(p));
    return `${basePath}?${search.toString()}`;
  };
  const linkCls = "rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50";
  const disabledCls = "pointer-events-none opacity-40";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-neutral-600 sm:px-5">
      <span>
        Page {page} of {totalPages} · {total} record(s)
      </span>
      <div className="flex gap-2">
        <Link href={href(Math.max(1, page - 1))} className={cn(linkCls, page <= 1 && disabledCls)} aria-disabled={page <= 1}>
          Previous
        </Link>
        <Link
          href={href(Math.min(totalPages, page + 1))}
          className={cn(linkCls, page >= totalPages && disabledCls)}
          aria-disabled={page >= totalPages}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

/** Button pager for client (react-query) pages. */
export function ButtonPager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-600 sm:px-5">
      <span>
        Page {page} of {Math.max(1, totalPages)} · {total} record(s)
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium hover:bg-neutral-50 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium hover:bg-neutral-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export const fieldCls =
  "h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200";

/** Server-rendered GET filter form: submitting reloads the page with the filters in the URL. */
export function FilterForm({
  action,
  fields,
  values,
}: {
  action: string;
  fields: { name: string; label: string; type?: "text" | "date" | "select"; options?: { value: string; label: string }[] }[];
  values: Record<string, string | undefined>;
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3 px-4 py-3 sm:px-5">
      {fields.map((f) => (
        <div key={f.name} className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-medium text-neutral-600 sm:flex-none">
          <span>{f.label}</span>
          {f.type === "select" ? (
            <div className="w-44">
              <Select
                className="h-10 rounded-xl"
                name={f.name}
                defaultValue={values[f.name] ?? ""}
                searchable={false}
                portal={true}
                options={[
                  { value: "", label: "All" },
                  ...(f.options ?? []),
                ]}
                aria-label={f.label}
              />
            </div>
          ) : (
            <input type={f.type ?? "text"} name={f.name} defaultValue={values[f.name] ?? ""} className={fieldCls} />
          )}
        </div>
      ))}
      {values.view ? <input type="hidden" name="view" value={values.view} /> : null}
      <div className="flex gap-2">
        <button type="submit" className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800">
          Apply
        </button>
        <Link href={values.view ? `${action}?view=${values.view}` : action} className="inline-flex h-10 items-center rounded-xl border border-neutral-200 px-4 text-sm font-medium hover:bg-neutral-50">
          Reset
        </Link>
      </div>
    </form>
  );
}

export const ORDER_STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
].map((v) => ({ value: v, label: humanize(v) }));

export const ORDER_SOURCE_LABELS: Record<string, string> = {
  CUSTOMER_DIRECT: "Customer Direct Order",
  AGENT_PLACED_FOR_CUSTOMER: "Agent Placed Order",
  AGENT_OWN: "Agent Own Order",
};
export const ORDER_SOURCE_OPTIONS = Object.entries(ORDER_SOURCE_LABELS).map(([value, label]) => ({ value, label }));

/** Source of an order, plus who placed it when that was not the customer. */
export function OrderSourceCell({ source, orderedBy }: { source: string; orderedBy: string | null }) {
  const tone =
    source === "AGENT_PLACED_FOR_CUSTOMER"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : source === "AGENT_OWN"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-neutral-200 bg-neutral-50 text-neutral-600";
  return (
    <div className="min-w-[8rem]">
      <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
        {ORDER_SOURCE_LABELS[source] ?? source}
      </span>
      {source !== "CUSTOMER_DIRECT" && orderedBy ? <p className="mt-1 text-xs text-neutral-500">Ordered by: {orderedBy}</p> : null}
    </div>
  );
}

export const COMMISSION_STATUS_OPTIONS = Object.entries(COMMISSION_STATUS_LABELS).map(([value, label]) => ({ value, label }));
export const PAYOUT_STATUS_OPTIONS = Object.entries(PAYOUT_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export function PageHeader({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-neutral-500">{description}</p>}
      </div>
      {children}
    </header>
  );
}

/** Panel that stays folded until the header is clicked. Native <details>, so it works in Server Components. */
export function CollapsiblePanel({
  title,
  action,
  children,
  defaultOpen = false,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn("group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs", className)}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
        <h2 className="text-sm font-bold tracking-tight text-neutral-900">{title}</h2>
        <span className="flex items-center gap-3">
          {action}
          <span className="text-xs font-semibold text-neutral-500 group-open:hidden">Show</span>
          <span className="hidden text-xs font-semibold text-neutral-500 group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="border-t border-neutral-100">{children}</div>
    </details>
  );
}

/** Loading placeholder that matches SimpleTable's footprint. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4 sm:p-5" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-neutral-100" />
      ))}
    </div>
  );
}
