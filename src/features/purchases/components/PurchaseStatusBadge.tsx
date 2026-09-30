import { Badge } from "@/components/ui/badge";
import type { PurchaseStatus } from "../types";

const config: Record<PurchaseStatus, { label: string; variant: "outline" | "warning" | "info" | "success" | "destructive" | "secondary" }> = {
  DRAFT: { label: "Draft", variant: "outline" },
  PENDING_APPROVAL: { label: "Pending approval", variant: "warning" },
  APPROVED: { label: "Approved", variant: "info" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  ORDERED: { label: "Ordered", variant: "info" },
  PARTIALLY_RECEIVED: { label: "Partially received", variant: "warning" },
  RECEIVED: { label: "Received", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

export const purchaseStatusOptions = (Object.keys(config) as PurchaseStatus[]).map((value) => ({
  value,
  label: config[value].label,
}));

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  const c = config[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}
