import { statusLabel } from "../lib/policy";

const TONES: Record<string, string> = {
  rejected: "bg-red-50 text-red-700 border-red-200",
  refunded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  replaced: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-neutral-100 text-neutral-600 border-neutral-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  under_review: "bg-amber-50 text-amber-700 border-amber-200",
  return_requested: "bg-orange-50 text-orange-700 border-orange-200",
  replacement_requested: "bg-orange-50 text-orange-700 border-orange-200",
};

export function RequestStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
        TONES[status] ?? "bg-purple-50 text-purple-700 border-purple-200"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}
