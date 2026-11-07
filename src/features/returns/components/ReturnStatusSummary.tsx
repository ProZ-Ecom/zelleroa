"use client";

import {
  AlertTriangle,
  BadgeIndianRupee,
  CalendarClock,
  CheckCircle2,
  Clock,
  Hourglass,
  PackageCheck,
  Search,
  Truck,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { formatStoreDate, getShipWindow, isReturnExceptionStatus } from "../lib/policy";
import { refundModeLabel, type RequestSummary } from "../lib/summary";

/**
 * Icon + colour for the status the request is sitting on. Keeps the headline
 * readable at a glance before any of the detail is expanded.
 */
const STATUS_LOOK: Record<string, { icon: LucideIcon; tone: "info" | "warn" | "good" | "bad" }> = {
  return_requested: { icon: Clock, tone: "info" },
  under_review: { icon: Search, tone: "info" },
  approved: { icon: PackageCheck, tone: "warn" },
  shipped_by_customer: { icon: Truck, tone: "info" },
  pickup_scheduled: { icon: Truck, tone: "info" },
  picked_up: { icon: Truck, tone: "info" },
  received: { icon: Hourglass, tone: "info" },
  refund_pending: { icon: Wallet, tone: "good" },
  refunded: { icon: CheckCircle2, tone: "good" },
  closed: { icon: CheckCircle2, tone: "good" },
  rejected: { icon: XCircle, tone: "bad" },
  qc_failed: { icon: AlertTriangle, tone: "bad" },
  returning_to_customer: { icon: Truck, tone: "warn" },
  returned_to_customer: { icon: PackageCheck, tone: "good" },
  expired: { icon: CalendarClock, tone: "bad" },
  cancelled: { icon: XCircle, tone: "bad" },
};

const TONE_CLASSES = {
  info: {
    box: "border-sky-200 bg-sky-50/80",
    icon: "bg-sky-100 text-sky-700",
    title: "text-sky-950",
    body: "text-sky-900",
  },
  warn: {
    box: "border-amber-200 bg-amber-50/80",
    icon: "bg-amber-100 text-amber-700",
    title: "text-amber-950",
    body: "text-amber-900",
  },
  good: {
    box: "border-emerald-200 bg-emerald-50/80",
    icon: "bg-emerald-100 text-emerald-700",
    title: "text-emerald-950",
    body: "text-emerald-900",
  },
  bad: {
    box: "border-red-200 bg-red-50/80",
    icon: "bg-red-100 text-red-700",
    title: "text-red-950",
    body: "text-red-800",
  },
} as const;

/**
 * "Where my return stands, in one sentence." The progress list carries the
 * whole history; this is the one line the customer actually needs, so it sits
 * outside the collapsible body.
 */
export function ReturnStatusHeadline({ req }: { req: RequestSummary }) {
  // Whole days, so server and client only differ across a store-day boundary;
  // `suppressHydrationWarning` covers that rather than an after-mount effect.
  const shipWindow = req.status === "approved" ? getShipWindow(req.approvedAt) : null;
  const daysLeft = shipWindow ? (shipWindow.expired ? 0 : shipWindow.daysLeft) : null;

  const steps = req.steps ?? [];
  const latest = [...steps].reverse().find((s) => s.state === "done");
  const next = steps.find((s) => s.state === "current");
  if (!latest && !next) return null;

  const status = latest?.status ?? req.status;
  const look = STATUS_LOOK[status] ?? { icon: Clock, tone: "info" as const };
  const tone = TONE_CLASSES[look.tone];
  const Icon = look.icon;
  const ended = isReturnExceptionStatus(req.status);

  return (
    <div className={`rounded-xl border p-3.5 ${tone.box}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={`text-sm font-bold ${tone.title}`}>{latest?.label ?? next?.label}</p>
            {latest?.at && (
              <span className={`text-[11px] ${tone.body}`}>{formatDateTime(latest.at)}</span>
            )}
            {daysLeft !== null && (
              <span
                suppressHydrationWarning
                className="rounded-full border border-amber-300 bg-white px-2 py-px text-[11px] font-bold text-amber-800"
              >
                {daysLeft > 0
                  ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to ship`
                  : "Shipping window closed"}
              </span>
            )}
          </div>
          {latest?.description && (
            <p className={`mt-1 text-xs leading-relaxed ${tone.body}`}>{latest.description}</p>
          )}
          {!ended && next && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-theme-text-muted">
              <Hourglass className="h-3 w-3 shrink-0" />
              Next: {next.label}
              {next.hint ? <span className="font-normal">· {next.hint}</span> : null}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The money side of a return, which the customer asks about more than anything
 * else: how much, to where, by when, and the reference once it is paid.
 */
export function ReturnRefundCard({ req }: { req: RequestSummary }) {
  const relevant = ["refund_pending", "refunded"].includes(req.status) || Boolean(req.completedAt);
  if (req.kind !== "return" || !relevant) return null;

  const paid = req.status === "refunded" || Boolean(req.refundTransactionRef);
  const amount = req.refundAmount ?? null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
      <div className="flex items-center gap-2">
        <BadgeIndianRupee className="h-4 w-4 shrink-0 text-emerald-700" />
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-950">
          Refund {paid ? "completed" : "in progress"}
        </p>
      </div>
      <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Amount</p>
          <p className="mt-0.5 text-base font-black text-emerald-950">
            {amount !== null ? formatPrice(amount) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            Refund to
          </p>
          <p className="mt-0.5 text-xs font-semibold text-neutral-900">
            {refundModeLabel(req)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            {paid ? "Reference no" : "Expected"}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-neutral-900">
            {paid
              ? (req.refundTransactionRef ?? "Shared by our team")
              : "Within 5–7 working days"}
          </p>
        </div>
      </div>
      {paid && req.completedAt && (
        <p className="mt-2 text-[11px] text-emerald-800">
          Credited on {formatStoreDate(new Date(req.completedAt))}. Bank credit can take a little
          longer to appear in your statement.
        </p>
      )}
    </div>
  );
}
