import Link from "next/link";
import { Inbox } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
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
  // returns & replacements
  return_requested: "bg-amber-50 text-amber-800 border-amber-200",
  under_review: "bg-purple-50 text-purple-800 border-purple-200",
  return_approved: "bg-blue-50 text-blue-800 border-blue-200",
  return_shipped: "bg-indigo-50 text-indigo-800 border-indigo-200",
  shipped_by_customer: "bg-indigo-50 text-indigo-800 border-indigo-200",
  return_received: "bg-teal-50 text-teal-800 border-teal-200",
  received: "bg-teal-50 text-teal-800 border-teal-200",
  refund_pending: "bg-amber-50 text-amber-800 border-amber-200",
  refunded: "bg-red-50 text-red-700 border-red-200",
  qc_failed: "bg-red-50 text-red-700 border-red-200",
  returning_to_customer: "bg-amber-50 text-amber-800 border-amber-200",
  returned_to_customer: "bg-neutral-100 text-neutral-700 border-neutral-200",
  return_rejected: "bg-red-50 text-red-700 border-red-200",
  return_expired: "bg-neutral-100 text-neutral-700 border-neutral-300",
  return_cancelled: "bg-neutral-100 text-neutral-700 border-neutral-300",
  return_closed: "bg-neutral-100 text-neutral-600 border-neutral-200",
  closed: "bg-neutral-100 text-neutral-600 border-neutral-200",
  replacement_requested: "bg-amber-50 text-amber-800 border-amber-200",
  replacement_approved: "bg-blue-50 text-blue-800 border-blue-200",
  replacement_processing: "bg-sky-50 text-sky-700 border-sky-200",
  replacement_shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
  replaced: "bg-emerald-50 text-emerald-800 border-emerald-200",
  replacement_rejected: "bg-red-50 text-red-700 border-red-200",
  replacement_expired: "bg-neutral-100 text-neutral-700 border-neutral-300",
  replacement_cancelled: "bg-neutral-100 text-neutral-700 border-neutral-300",
  replacement_closed: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

const PRODUCT_ORDER_STATUS_LABELS: Record<string, string> = {
  return_requested: "Return Requested",
  under_review: "Return Under Review",
  return_approved: "Return Approved",
  return_shipped: "Return Shipped",
  shipped_by_customer: "Return Shipped",
  return_received: "Return Received",
  received: "Return Received",
  refund_pending: "Refund Pending",
  refunded: "Returned",
  returned: "Returned",
  qc_failed: "QC Failed",
  returning_to_customer: "Sending Back",
  returned_to_customer: "Returned to Customer",
  return_rejected: "Return Rejected",
  return_expired: "Return Expired",
  return_cancelled: "Return Cancelled",
  return_closed: "Return Closed",
  closed: "Return Closed",
  replacement_requested: "Replacement Requested",
  replacement_approved: "Replacement Approved",
  replacement_processing: "Replacement Processing",
  replacement_shipped: "Replacement Shipped",
  replaced: "Replaced",
  replacement_rejected: "Replacement Rejected",
  replacement_expired: "Replacement Expired",
  replacement_cancelled: "Replacement Cancelled",
  replacement_closed: "Replacement Closed",
};

export function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return (
    COMMISSION_STATUS_LABELS[value] ??
    PAYOUT_STATUS_LABELS[value] ??
    PRODUCT_ORDER_STATUS_LABELS[value] ??
    value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function StatusBadge({ status, className, title }: { status: string | null | undefined; className?: string; title?: string }) {
  if (!status) return <span className="text-neutral-400">—</span>;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center text-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
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
export const dateOnly = (v: string | Date | null | undefined) => formatDate(v);
export const dateTime = (v: string | Date | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";

  const datePart = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, "0");

  return `${datePart}, ${strHours}:${minutes} ${ampm}`;
};

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
    <section className={cn("overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-8px_rgba(16,24,40,0.08)]", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3.5 sm:px-5 bg-white">
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
  headerClassName?: string;
  /** Pin this column to the right edge while the table scrolls horizontally. */
  stickyRight?: boolean;
}

const STICKY_RIGHT_HEADER =
  "text-center sticky top-0 right-0 z-30 shadow-[-8px_0_12px_-6px_rgba(28,25,23,0.3)] bg-stone-900 text-[#D4AF37] border-b border-stone-800";
const STICKY_RIGHT_CELL =
  "text-center [&>div]:justify-center [&>div]:items-center sticky right-0 z-20 shadow-[-8px_0_12px_-6px_rgba(16,24,40,0.06)] bg-white group-hover:bg-neutral-50/80 border-b border-neutral-100";

/** Responsive admin table with signature luxury dark stone & gold header matching DataTable. */
export function SimpleTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing to show yet.",
  className,
  tableClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  className?: string;
  tableClassName?: string;
}) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Scrollable table content"
      className={cn(
        "relative flex-1 min-h-0 overflow-auto overscroll-x-contain scrollbar-table focus:outline-hidden focus-visible:ring-1 focus-visible:ring-secondary-300",
        className
      )}
    >
      <table
        className={cn(
          "w-full min-w-max table-auto caption-bottom text-sm border-separate border-spacing-0",
          tableClassName
        )}
      >
        <thead>
          <tr className="transition-colors">
            {columns.map((c, i) => {
              const isActions =
                Boolean(c.stickyRight) ||
                c.header.toLowerCase() === "actions" ||
                c.header.trim() === "";
              return (
                <th
                  key={`${i}-${c.header}`}
                  className={cn(
                    "group/th h-12 px-4 text-left align-middle text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase sm:px-5 bg-stone-900 text-[#D4AF37] border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)] sticky top-0 z-10",
                    isActions && STICKY_RIGHT_HEADER,
                    c.headerClassName,
                    c.className
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1",
                      isActions ? "justify-center" : ""
                    )}
                  >
                    {c.header}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="group transition-colors hover:bg-neutral-50/80 border-b border-neutral-100 last:border-0"
              >
                {columns.map((c, i) => {
                  const isActions =
                    Boolean(c.stickyRight) ||
                    c.header.toLowerCase() === "actions" ||
                    c.header.trim() === "";
                  return (
                    <td
                      key={`${i}-${c.header}`}
                      className={cn(
                        "px-4 py-3.5 align-middle whitespace-nowrap sm:px-5 text-sm text-neutral-800 bg-white group-hover:bg-neutral-50/80 transition-colors border-b border-neutral-100",
                        isActions && STICKY_RIGHT_CELL,
                        c.className
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="h-32 text-center text-neutral-500 bg-white border-b border-neutral-100"
              >
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                    <Inbox className="h-5 w-5" />
                  </span>
                  <p className="max-w-xs text-sm text-neutral-500 font-medium">{empty}</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
        <button type="submit" className="h-10 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-4 text-sm font-semibold text-white transition-colors">
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
  "return_requested",
  "return_approved",
  "return_closed",
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

/** Loading placeholder that matches SimpleTable's luxury dark/gold footprint. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full overflow-hidden" role="status" aria-label="Loading">
      <div className="h-12 bg-stone-900 border-b border-stone-800 flex items-center px-4 sm:px-5 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-3.5 bg-stone-800 rounded animate-pulse flex-1" />
        ))}
      </div>
      <div className="divide-y divide-neutral-100 bg-white">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center px-4 sm:px-5 py-3.5 gap-4">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-4 bg-neutral-100 rounded animate-pulse flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { Tooltip, type TooltipProps, type TooltipSide } from "./Tooltip";
export { BlockAgentDialog, type BlockAgentPayload, type BlockAgentDialogAgent } from "./admin/BlockAgentDialog";

