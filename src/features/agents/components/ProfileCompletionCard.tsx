import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { Completion } from "../lib/profile-completion";
import { ProfileCompletionMeter } from "@/components/ui/ProfileCompletionMeter";
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
  const ctaClass =
    "inline-flex h-10 w-full items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800 sm:w-auto";
  const cta = first ? (
    onNavigate ? (
      <button type="button" onClick={() => onNavigate(first.step)} className={ctaClass}>
        Complete Details
      </button>
    ) : (
      <Link href={`/agent/profile?step=${first.step}`} className={ctaClass}>
        Complete Details
      </Link>
    )
  ) : null;

  return (
    <Panel title="Profile completion">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <ProfileCompletionMeter percent={percent} action={cta} />

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

      </div>
    </Panel>
  );
}
