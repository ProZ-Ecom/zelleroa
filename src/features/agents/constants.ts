import { RETURN_WINDOW_DAYS } from "@/features/returns/lib/deadlines";

export const RETURN_PERIOD_SETTING_KEY = "agent_commission_return_period_days";
export const DEFAULT_RETURN_PERIOD_DAYS = RETURN_WINDOW_DAYS;

/**
 * When on, a commission that clears its return period goes straight to
 * `approved` instead of waiting in `pending_approval` for an admin. The admin
 * then reviews the money once, on the payout request, rather than twice.
 */
export const AUTO_APPROVE_SETTING_KEY = "agent_commission_auto_approve";
export const DEFAULT_AUTO_APPROVE = false;

/** Commission statuses that can still be paid out or are already inside a payout. */
export const OPEN_COMMISSION_STATUSES = [
  "pending",
  "pending_approval",
  "approved",
  "payout_requested",
  "payout_approved",
] as const;

export const COMMISSION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  pending_approval: "Awaiting approval",
  approved: "Approved",
  payout_requested: "Payout requested",
  payout_approved: "Payout approved",
  paid: "Paid",
  cancelled: "Cancelled",
  reversed: "Reversed",
};

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  cancelled: "Cancelled",
};

export type AuditActor = { id: bigint | null; role: "ADMIN" | "STAFF" | "AGENT" | "CUSTOMER" | "USER" | "SYSTEM" };
export const SYSTEM_ACTOR: AuditActor = { id: null, role: "SYSTEM" };
