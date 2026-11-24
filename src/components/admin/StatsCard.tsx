"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

function StatsCard({ title, value, icon: Icon, description, trend, className }: StatsCardProps) {
  return (
    <div
      className={cn(
        "h-full min-h-36 rounded-2xl border border-[var(--color-neutral-200)] bg-white px-4 py-3",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-wider text-[var(--color-neutral-500)] uppercase">
          {title}
        </p>

        {Icon && (
          <div className="rounded-xl bg-[var(--color-neutral-100)] p-3">
            <Icon className="h-5 w-5 text-[var(--color-neutral-600)]" />
          </div>
        )}
      </div>

      <div className="">
        <h3 className="text-2xl sm:text-3xl font-bold text-[var(--color-neutral-900)] tabular-nums truncate">{value}</h3>

        {(description || trend) && (
          <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {description && (
              <p className="text-sm text-[var(--color-neutral-500)]">{description}</p>
            )}

            {trend && (
              <span
                className={cn(
                  "inline-flex items-center text-sm font-medium",
                  trend.isPositive
                    ? "text-[var(--color-success-700)]"
                    : "text-[var(--color-error-700)]"
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="mr-1 h-4 w-4" />
                ) : (
                  <TrendingDown className="mr-1 h-4 w-4" />
                )}
                {trend.value}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { StatsCard };
export type { StatsCardProps };
