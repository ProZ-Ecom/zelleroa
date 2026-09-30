import { Check, Circle, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { TimelineEvent } from "../lib/summary";

export function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events || events.length === 0) return null;

  return (
    <ol className="relative space-y-0">
      {events.map((e, idx) => {
        const last = idx === events.length - 1;
        const danger = e.tone === "danger";
        const dot =
          e.state === "done"
            ? danger
              ? "bg-red-600 text-white border-red-600"
              : "bg-emerald-600 text-white border-emerald-600"
            : e.state === "current"
              ? "bg-white text-secondary-600 border-secondary-600"
              : "bg-white text-neutral-300 border-neutral-300";

        return (
          <li key={e.key} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && (
              <span
                className={`absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px ${
                  e.state === "done" ? "bg-emerald-300" : "bg-neutral-200"
                }`}
              />
            )}
            <span className={`z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${dot}`}>
              {e.state === "done" ? (
                danger ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-2.5 w-2.5 fill-current" />
              )}
            </span>
            <div className="min-w-0">
              <p
                className={`text-xs font-bold uppercase tracking-wider ${
                  e.state === "upcoming" ? "text-neutral-400" : danger ? "text-red-700" : "text-theme-text-primary"
                }`}
              >
                {e.label}
                {e.group && (
                  <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-neutral-500">
                    {e.group}
                  </span>
                )}
              </p>
              {e.at && (
                <p className="text-[11px] text-theme-text-subtle">{formatDateTime(e.at)}</p>
              )}
              {e.note && <p className="mt-0.5 text-xs text-theme-text-muted">{e.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
