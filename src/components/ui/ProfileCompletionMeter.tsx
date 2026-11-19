import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

interface ProfileCompletionMeterProps {
  /** 0–100 completed share. */
  percent: number;
  /** Names of required fields still empty (shown as a hint). */
  missing?: string[];
  /** CTA, rendered only while the profile is incomplete. */
  action?: ReactNode;
  className?: string;
}

const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Compact completion widget: ring + split bar + completed/incomplete figures. Role-agnostic. */
export function ProfileCompletionMeter({ percent, missing = [], action, className = "" }: ProfileCompletionMeterProps) {
  const completed = Math.min(100, Math.max(0, Math.round(percent)));
  const incomplete = 100 - completed;
  const done = completed === 100;
  const fill = done ? "text-emerald-500" : "text-amber-500";

  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 ${className}`}>
      <div className="relative h-[72px] w-[72px] shrink-0 2xl:h-24 2xl:w-24">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="36" cy="36" r={RADIUS} fill="none" strokeWidth="7" className="stroke-neutral-200" />
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            stroke="currentColor"
            className={`${fill} transition-all duration-500`}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - completed / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-neutral-900 2xl:text-xl">
          {completed}%
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        {done ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 2xl:text-base">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Profile Complete
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold 2xl:text-base">
            <span className="text-emerald-700">Profile Completed: {completed}%</span>
            <span className="text-amber-700">Profile Incomplete: {incomplete}%</span>
          </div>
        )}

        <div
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-amber-100 2xl:h-3"
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completion"
        >
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${completed}%` }}
          />
        </div>

        {!done && missing.length > 0 && (
          <p className="truncate text-xs text-neutral-500 2xl:text-sm" title={missing.join(", ")}>
            Missing: {missing.join(", ")}
          </p>
        )}
      </div>

      {!done && action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
