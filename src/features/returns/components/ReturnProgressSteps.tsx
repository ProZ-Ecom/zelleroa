import { Check, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { RequestStep } from "../lib/summary";

/**
 * The customer's view of where a return stands: reached steps carry their
 * status sentence, the step being waited on is highlighted with a greyed-out
 * hint, and an exception ending replaces every step that is no longer coming.
 */
export function ReturnProgressSteps({ steps }: { steps: RequestStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <ol className="space-y-1">
      {steps.map((step, idx) => {
        const last = idx === steps.length - 1;
        const danger = step.tone === "danger";
        const success = step.tone === "success";
        const done = step.state === "done";
        const current = step.state === "current";

        const marker = done
          ? danger
            ? "border-red-500 bg-red-500 text-white"
            : "border-emerald-500 bg-emerald-500 text-white"
          : current
            ? "border-theme-secondary bg-theme-surface text-theme-secondary"
            : "border-theme-border bg-theme-surface text-theme-text-subtle";

        return (
          <li key={`${step.status}-${idx}`} className="relative flex gap-3">
            {/* Connector runs from this marker to the next one. */}
            {!last && (
              <span
                aria-hidden
                className={`absolute left-[13px] top-7 bottom-0 w-px ${
                  done ? (danger ? "bg-red-200" : "bg-emerald-200") : "bg-theme-border-subtle"
                }`}
              />
            )}
            <span
              className={`z-10 mt-1 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${marker}`}
            >
              {done ? (
                danger ? (
                  <X className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                )
              ) : (
                idx + 1
              )}
            </span>

            <div
              className={`min-w-0 flex-1 rounded-lg px-2.5 py-1.5 ${last ? "mb-0" : "mb-2"} ${
                current
                  ? "bg-theme-surface-alt ring-1 ring-theme-border-subtle"
                  : danger && done
                    ? "bg-red-50/70"
                    : success && done
                      ? "bg-emerald-50/60"
                      : ""
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p
                  className={`text-[13px] font-semibold leading-snug ${
                    danger && done
                      ? "text-red-700"
                      : done || current
                        ? "text-theme-text-primary"
                        : "text-theme-text-subtle"
                  }`}
                >
                  {step.label}
                </p>
                {current && (
                  <span className="rounded-full bg-theme-secondary/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-theme-secondary">
                    In progress
                  </span>
                )}
                {step.at && (
                  <span className="text-[11px] text-theme-text-subtle">
                    {formatDateTime(step.at)}
                  </span>
                )}
              </div>
              {step.description && (
                <p
                  className={`mt-0.5 text-xs leading-relaxed ${
                    danger && done ? "text-red-700" : "text-theme-text-muted"
                  }`}
                >
                  {step.description}
                </p>
              )}
              {step.hint && (
                <p className="mt-0.5 text-[11px] text-theme-text-subtle">{step.hint}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
