"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Download, Info, Minus } from "lucide-react";
import { Select } from "@/components/ui/select";
import { downloadCsv, formatCsvDateTime } from "@/lib/export-csv";
import { cn } from "@/lib/utils";

export { formatCsvDateTime };

/* ------------------------------------------------------------------ formatting */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const counter = new Intl.NumberFormat("en-IN");

export const money = (n: number | null | undefined) => (n == null ? "—" : inr.format(n));
export const moneyExact = (n: number | null | undefined) => (n == null ? "—" : inrExact.format(n));
export const count = (n: number | null | undefined) => (n == null ? "—" : counter.format(n));
export const percent = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);
export const days = (n: number | null | undefined) => (n == null ? "—" : `${n} day${n === 1 ? "" : "s"}`);

export function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Turns a bucket key (2026-11-06, 2026-11 or a Monday) into something readable on an axis. */
export function bucketLabel(key: string, bucket: "day" | "week" | "month") {
  if (bucket === "month") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }
  const d = new Date(key);
  if (Number.isNaN(d.getTime())) return key;
  const short = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return bucket === "week" ? `w/c ${short}` : short;
}

/* ----------------------------------------------------------------- date presets */

export interface DatePreset {
  id: string;
  label: string;
  range: () => { dateFrom: string; dateTo: string };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

export const DATE_PRESETS: DatePreset[] = [
  { id: "today", label: "Today", range: () => ({ dateFrom: iso(new Date()), dateTo: iso(new Date()) }) },
  { id: "yesterday", label: "Yesterday", range: () => ({ dateFrom: iso(shift(-1)), dateTo: iso(shift(-1)) }) },
  { id: "7d", label: "Last 7 days", range: () => ({ dateFrom: iso(shift(-6)), dateTo: iso(new Date()) }) },
  { id: "30d", label: "Last 30 days", range: () => ({ dateFrom: iso(shift(-29)), dateTo: iso(new Date()) }) },
  {
    id: "month",
    label: "This month",
    range: () => {
      const now = new Date();
      return { dateFrom: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), dateTo: iso(now) };
    },
  },
  {
    id: "lastMonth",
    label: "Last month",
    range: () => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      return { dateFrom: iso(start), dateTo: iso(end) };
    },
  },
  {
    id: "year",
    label: "This year",
    range: () => {
      const now = new Date();
      return { dateFrom: iso(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), dateTo: iso(now) };
    },
  },
];

export const DEFAULT_PRESET = "30d";

export function presetRange(id: string) {
  return (DATE_PRESETS.find((p) => p.id === id) ?? DATE_PRESETS[3]).range();
}

/* ------------------------------------------------------------------ filter bar */

export interface ExtraFilter {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

interface ReportFiltersProps {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  extras?: ExtraFilter[];
  children?: React.ReactNode;
}

/**
 * One filter bar for every report: preset chips first (what people actually use),
 * exact dates behind a "Custom range" chip, and any report-specific dropdowns after.
 */
export function ReportFilters({ value, onChange, extras = [], children }: ReportFiltersProps) {
  const activePreset = value.preset ?? DEFAULT_PRESET;
  const isCustom = activePreset === "custom";

  const setPreset = (id: string) => {
    if (id === "custom") {
      onChange({ ...value, preset: "custom" });
      return;
    }
    onChange({ ...value, preset: id, ...presetRange(id) });
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Period</span>
        {DATE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={activePreset === p.id}
            onClick={() => setPreset(p.id)}
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
              activePreset === p.id
                ? "border-theme-primary bg-theme-primary text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() => setPreset("custom")}
          className={cn(
            "h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
            isCustom
              ? "border-theme-primary bg-theme-primary text-white"
              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          )}
        >
          Custom range
        </button>
      </div>

      {(isCustom || extras.length > 0 || children) && (
        <div className="flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-3">
          {isCustom && (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                <span>From</span>
                <input
                  type="date"
                  className="h-10 w-40 rounded-xl border border-neutral-200 px-3 text-sm"
                  value={value.dateFrom ?? ""}
                  max={value.dateTo || undefined}
                  onChange={(e) => onChange({ ...value, preset: "custom", dateFrom: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                <span>To</span>
                <input
                  type="date"
                  className="h-10 w-40 rounded-xl border border-neutral-200 px-3 text-sm"
                  value={value.dateTo ?? ""}
                  min={value.dateFrom || undefined}
                  onChange={(e) => onChange({ ...value, preset: "custom", dateTo: e.target.value })}
                />
              </label>
            </>
          )}

          {extras.map((f) => (
            <div key={f.name} className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
              <span>{f.label}</span>
              <div className="w-52">
                <Select
                  className="h-10 rounded-xl"
                  value={value[f.name] ?? ""}
                  onValueChange={(v) => onChange({ ...value, [f.name]: v })}
                  portal
                  options={[{ value: "", label: "All" }, ...f.options]}
                  aria-label={f.label}
                />
              </div>
            </div>
          ))}

          {children}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- layout */

export function Panel({
  title,
  hint,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-8px_rgba(16,24,40,0.08)]",
        className
      )}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-100 px-4 py-3.5 sm:px-5 bg-white">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-neutral-900">{title}</h2>
            {hint && <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A plain-language note for anything a number cannot say on its own. */
export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed",
        tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"
      )}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- metric cards */

export function DeltaBadge({ value, compareLabel }: { value: number | null | undefined; compareLabel?: string }) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
        <Minus className="h-3 w-3" /> no earlier data
      </span>
    );
  }
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      title={compareLabel ? `Compared with the ${compareLabel}` : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        flat ? "bg-neutral-100 text-neutral-600" : up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      )}
    >
      <Icon className="h-3 w-3" />
      {flat ? "no change" : `${up ? "+" : ""}${value}%`}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  delta,
  compareLabel,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: number | null;
  compareLabel?: string;
  tone?: "default" | "good" | "warn" | "bad";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const bar = {
    default: "bg-neutral-300",
    good: "bg-emerald-400",
    warn: "bg-amber-400",
    bad: "bg-rose-400",
  }[tone];
  const text = {
    default: "text-neutral-900",
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-rose-700",
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md">
      <span className={cn("absolute inset-x-0 top-0 h-0.5", bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={cn("mt-2 text-xl font-bold tracking-tight sm:text-2xl", text)}>{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {delta !== undefined && <DeltaBadge value={delta} compareLabel={compareLabel} />}
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- tables */

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Plain value for CSV; falls back to the cell when it is a string or number. */
  csv?: (row: T) => string | number | null;
  align?: "left" | "right";
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing in this period.",
  emptyHint,
  maxHeight,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  emptyHint?: string;
  maxHeight?: string;
}) {
  if (rows.length === 0) {
    return (
      <div
        tabIndex={0}
        role="region"
        aria-label="Scrollable table content"
        className={cn(
          "relative flex-1 min-h-0 overflow-auto overscroll-x-contain scrollbar-table focus:outline-hidden focus-visible:ring-1 focus-visible:ring-secondary-300",
          maxHeight
        )}
      >
        <table className="w-full min-w-max table-auto caption-bottom text-sm border-separate border-spacing-0">
          <thead className="bg-stone-900 text-[#D4AF37] border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)] sticky top-0 z-10">
            <tr>
              {columns.map((c, i) => (
                <th
                  key={`${i}-${c.header}`}
                  className={cn(
                    "group/th h-12 px-4 text-left align-middle text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase sm:px-5 bg-stone-900 text-[#D4AF37] border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)] sticky top-0 z-10",
                    c.align === "right" && "text-right",
                    c.className
                  )}
                >
                  <div className={cn("flex items-center gap-1", c.align === "right" ? "justify-end" : "justify-start")}>
                    {c.header}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-12 text-center text-sm text-neutral-500 bg-white border-b border-neutral-100"
              >
                <p className="font-medium text-neutral-700">{empty}</p>
                {emptyHint && <p className="mt-1 max-w-sm mx-auto text-xs text-neutral-500">{emptyHint}</p>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Scrollable table content"
      className={cn(
        "relative flex-1 min-h-0 overflow-auto overscroll-x-contain scrollbar-table focus:outline-hidden focus-visible:ring-1 focus-visible:ring-secondary-300",
        maxHeight
      )}
    >
      <table className="w-full min-w-max table-auto caption-bottom text-sm border-separate border-spacing-0">
        <thead className="bg-stone-900 text-[#D4AF37] border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)] sticky top-0 z-10">
          <tr className="transition-colors">
            {columns.map((c, i) => (
              <th
                key={`${i}-${c.header}`}
                className={cn(
                  "group/th h-12 px-4 text-left align-middle text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase sm:px-5 bg-stone-900 text-[#D4AF37] border-b border-stone-800 shadow-[0_1px_3px_rgba(28,25,23,0.2)] sticky top-0 z-10",
                  c.align === "right" && "text-right",
                  c.className
                )}
              >
                <div className={cn("flex items-center gap-1", c.align === "right" ? "justify-end" : "justify-start")}>
                  {c.header}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="group transition-colors hover:bg-neutral-50/80 border-b border-neutral-100 last:border-0"
            >
              {columns.map((c, i) => (
                <td
                  key={`${i}-${c.header}`}
                  className={cn(
                    "px-4 py-3.5 align-middle whitespace-nowrap sm:px-5 text-sm text-neutral-800 bg-white group-hover:bg-neutral-50/80 transition-colors border-b border-neutral-100",
                    c.align === "right" && "text-right tabular-nums",
                    c.className
                  )}
                >
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

/** Download button wired to a table's own columns, so the CSV matches what is on screen. */
export function ExportButton<T>({
  rows,
  columns,
  fileName,
  label = "Download CSV",
}: {
  rows: T[];
  columns: Column<T>[];
  fileName: string;
  label?: string;
}) {
  const disabled = rows.length === 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const headers = columns.map((c) => c.header);
        const body = rows.map((row) =>
          columns.map((c) => {
            if (c.csv) return c.csv(row);
            const raw = c.cell(row);
            return typeof raw === "string" || typeof raw === "number" ? raw : "";
          })
        );
        downloadCsv(headers, body, fileName);
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors",
        disabled
          ? "cursor-not-allowed border-neutral-200 text-neutral-400"
          : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
      )}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/** Inline share bar, so a table reads at a glance without a separate chart. */
export function ShareBar({ share }: { share: number }) {
  const width = Math.max(0, Math.min(100, share));
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-neutral-100 sm:block" aria-hidden>
        <span className="block h-full rounded-full bg-theme-primary" style={{ width: `${width}%` }} />
      </span>
      <span className="tabular-nums text-neutral-600">{share}%</span>
    </span>
  );
}

/* ---------------------------------------------------------------------- charts */

export interface SeriesDef<T> {
  key: string;
  label: string;
  value: (row: T) => number;
  color: string;
  /** Bars read better for counts, the line for money. */
  kind?: "line" | "bar";
}

/**
 * Small multi-series chart drawn as inline SVG - no chart dependency, and it
 * scales down to a phone. Each point carries a <title> so hovering reads the value.
 */
export function TrendChart<T extends { bucket: string }>({
  data,
  series,
  bucket,
  format = (n) => String(n),
  height = 220,
}: {
  data: T[];
  series: SeriesDef<T>[];
  bucket: "day" | "week" | "month";
  format?: (n: number) => string;
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="px-5 py-12 text-center text-sm text-neutral-500">No activity in this period.</p>;
  }

  const width = 820;
  const pad = { top: 16, right: 16, bottom: 34, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const max = Math.max(1, ...data.flatMap((row) => series.map((s) => s.value(row))));
  const x = (i: number) => (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => plotH - (v / max) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const barSeries = series.filter((s) => s.kind === "bar");
  const bandW = plotW / data.length;

  return (
    <div className="w-full overflow-x-auto px-2 py-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[520px]" role="img">
        <g transform={`translate(${pad.left},${pad.top})`}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke="#f1f5f9" strokeWidth={1} />
              <text x={-10} y={y(t) + 4} textAnchor="end" className="fill-neutral-400" style={{ fontSize: 10 }}>
                {format(Math.round(t))}
              </text>
            </g>
          ))}

          {barSeries.map((s, si) => (
            <g key={s.key}>
              {data.map((row, i) => {
                const v = s.value(row);
                const w = Math.max(2, (bandW * 0.5) / barSeries.length);
                const cx = x(i) - (barSeries.length * w) / 2 + si * w;
                return (
                  <rect
                    key={row.bucket}
                    x={cx}
                    y={y(v)}
                    width={w}
                    height={Math.max(0, plotH - y(v))}
                    rx={2}
                    fill={s.color}
                    opacity={0.75}
                  >
                    <title>{`${bucketLabel(row.bucket, bucket)} · ${s.label}: ${format(v)}`}</title>
                  </rect>
                );
              })}
            </g>
          ))}

          {series
            .filter((s) => s.kind !== "bar")
            .map((s) => (
              <g key={s.key}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  points={data.map((row, i) => `${x(i)},${y(s.value(row))}`).join(" ")}
                />
                {data.map((row, i) => (
                  <circle key={row.bucket} cx={x(i)} cy={y(s.value(row))} r={3} fill="#fff" stroke={s.color} strokeWidth={2}>
                    <title>{`${bucketLabel(row.bucket, bucket)} · ${s.label}: ${format(s.value(row))}`}</title>
                  </circle>
                ))}
              </g>
            ))}

          <line x1={0} x2={plotW} y1={plotH} y2={plotH} stroke="#e2e8f0" strokeWidth={1} />
          {data.map((row, i) =>
            i % labelEvery === 0 || i === data.length - 1 ? (
              <text
                key={row.bucket}
                x={x(i)}
                y={plotH + 18}
                textAnchor="middle"
                className="fill-neutral-500"
                style={{ fontSize: 10 }}
              >
                {bucketLabel(row.bucket, bucket)}
              </text>
            ) : null
          )}
        </g>
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-4 px-3">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export const CHART_COLORS = {
  primary: "#2563eb",
  teal: "#0d9488",
  amber: "#d97706",
  rose: "#e11d48",
  violet: "#7c3aed",
  slate: "#64748b",
};

/* ------------------------------------------------------------------- feedback */

export function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
      <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
    </div>
  );
}

export function ReportError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-12 text-center">
      <p className="text-sm font-semibold text-rose-800">This report could not be loaded.</p>
      <p className="max-w-md text-xs text-rose-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-9 rounded-xl border border-rose-300 bg-white px-4 text-xs font-semibold text-rose-700 hover:bg-rose-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** "1 Oct 2026 – 30 Oct 2026 · 30 days" under the page title. */
export function RangeCaption({ from, to, days: span }: { from: string; to: string; days: number }) {
  return (
    <p className="text-xs text-neutral-500">
      {dateLabel(from)} – {dateLabel(to)} · {span} day{span === 1 ? "" : "s"}
    </p>
  );
}

export function compareLabelFor(span: number) {
  return `previous ${span} day${span === 1 ? "" : "s"}`;
}
