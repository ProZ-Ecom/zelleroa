"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

/** [from, to] gradient stops for the icon tile; the first also tints the corner glow. */
const TONES: Record<Tone, [string, string]> = {
  primary: ["var(--primary-500)", "var(--primary-700)"],
  success: ["var(--success-500)", "var(--success-700)"],
  warning: ["var(--yellow-400)", "var(--yellow-600)"],
  danger: ["var(--error-500)", "var(--error-700)"],
  neutral: ["var(--neutral-500)", "var(--neutral-700)"],
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  /** Today's value, shown small under the headline total. */
  today?: string | number;
  todayLabel?: string;
  /** Percentage change vs yesterday; null = no baseline to compare against. */
  change?: number | null;
  /** When true, an increase is bad (cancellations, returns, pending). */
  invertChange?: boolean;
}

function ChangeLine({
  change,
  label,
  invert,
}: {
  change: number | null | undefined;
  label: string;
  invert?: boolean;
}) {
  if (change === undefined) return null;
  if (change === null) {
    return (
      <span className="rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-neutral-500)]">
        New
      </span>
    );
  }
  const flat = change === 0;
  const good = invert ? change < 0 : change > 0;
  const Icon = flat ? Minus : change > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        flat
          ? "bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]"
          : good
            ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
            : "bg-[var(--color-error-50)] text-[var(--color-error-700)]"
      )}
    >
      <Icon className="h-3 w-3" />
      {change > 0 ? "+" : ""}
      {change}%
    </span>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone = "primary",
  today,
  todayLabel = "today",
  change,
  invertChange,
}: MetricCardProps) {
  const [from, to] = TONES[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--color-neutral-200)]/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(16,24,40,0.18)]">
      {/* corner glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-[0.12] blur-2xl transition-opacity group-hover:opacity-25"
        style={{ background: from }}
      />

      <div className="relative flex items-center justify-between gap-3">
        <p className="min-w-0 text-[11px] font-semibold tracking-[0.08em] text-[var(--color-neutral-500)] uppercase">
          {title}
        </p>
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <h3
        title={String(value)}
        className="relative mt-1 text-[26px] leading-tight font-bold tracking-tight break-words text-[var(--color-neutral-900)] tabular-nums sm:text-[28px]"
      >
        {value}
      </h3>

      {today !== undefined && (
        <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-dashed border-[var(--color-neutral-200)] pt-3">
          <span className="text-xs text-[var(--color-neutral-500)]">
            <span className="text-sm font-semibold text-[var(--color-neutral-900)] tabular-nums">
              {today}
            </span>{" "}
            {todayLabel}
          </span>
          <ChangeLine change={change} label="vs yesterday" invert={invertChange} />
        </div>
      )}
    </div>
  );
}

export { MetricCard };
export type { Tone };
