import { returnStatusLabel, statusLabel } from "../lib/policy";

const TONES: Record<string, string> = {
  rejected: "bg-red-50 text-red-700 border-red-200",
  qc_failed: "bg-red-50 text-red-700 border-red-200",
  returning_to_customer: "bg-amber-50 text-amber-700 border-amber-200",
  returned_to_customer: "bg-slate-50 text-slate-700 border-slate-200",
  expired: "bg-neutral-100 text-neutral-700 border-neutral-300",
  cancelled: "bg-neutral-100 text-neutral-700 border-neutral-300",
  refunded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  replaced: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-neutral-100 text-neutral-600 border-neutral-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  shipped_by_customer: "bg-sky-50 text-sky-700 border-sky-200",
  received: "bg-indigo-50 text-indigo-700 border-indigo-200",
  under_review: "bg-amber-50 text-amber-700 border-amber-200",
  return_requested: "bg-orange-50 text-orange-700 border-orange-200",
  replacement_requested: "bg-orange-50 text-orange-700 border-orange-200",
};

export function RequestStatusBadge({
  status,
  kind = "return",
}: {
  status: string;
  /** Returns use the return-specific wording ("Return Rejected", "QC Failed"). */
  kind?: "return" | "replacement";
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
        TONES[status] ?? "bg-purple-50 text-purple-700 border-purple-200"
      }`}
    >
      {kind === "return" ? returnStatusLabel(status) : statusLabel(status)}
    </span>
  );
}
