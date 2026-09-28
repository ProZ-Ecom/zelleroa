export const RETURN_PERIOD_SETTING_KEY = "agent_commission_return_period_days";
export const DEFAULT_RETURN_PERIOD_DAYS = 3;

/** Commission statuses that can still be paid out or are already inside a payout. */
export const OPEN_COMMISSION_STATUSES = [
  "pending",
  "approved",
  "payout_requested",
  "payout_approved",
] as const;

export const COMMISSION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
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
