import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { Completion } from "../lib/profile-completion";
import { Panel } from "./shared";

/** Progress bar + the sections still to do. `onNavigate` lets the wizard jump a step instead of linking. */
export function ProfileCompletionCard({
  completion,
  compact = false,
  onNavigate,
}: {
  completion: Completion;
  compact?: boolean;
  onNavigate?: (step: string) => void;
}) {
  const { percent, sections, incomplete } = completion;
  const first = incomplete[0];

  return (
    <Panel title="Profile completion">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-neutral-900">Profile Completion: {percent}%</span>
            {incomplete.length === 0 && <span className="text-xs font-semibold text-emerald-700">All done</span>}
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-neutral-100"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
          >
            <div
              className={`h-full rounded-full transition-all ${percent === 100 ? "bg-emerald-500" : "bg-neutral-900"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {!compact && (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.key} className="flex items-start gap-2 text-sm">
                {s.complete ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                )}
                <span className="min-w-0">
                  <span className="font-medium text-neutral-900">{s.label}</span>{" "}
                  <span className="text-neutral-500">– {Math.round(s.points)}/{s.weight}%</span>
                  {!s.complete && <span className="block truncate text-xs text-neutral-500">Missing: {s.missing.join(", ")}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {first &&
          (onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate(first.step)}
              className="inline-flex h-10 w-fit items-center rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Complete Now
            </button>
          ) : (
            <Link
              href={`/agent/profile?step=${first.step}`}
              className="inline-flex h-10 w-fit items-center rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Complete Now
            </Link>
          ))}
      </div>
    </Panel>
  );
}
