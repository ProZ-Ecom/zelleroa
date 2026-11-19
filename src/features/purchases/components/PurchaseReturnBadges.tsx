import { Badge } from "@/components/ui/badge";
import type { PurchaseReturnReason, PurchaseReturnStatus } from "../types";

type Variant = "outline" | "warning" | "info" | "success" | "destructive" | "secondary";

const statusConfig: Record<PurchaseReturnStatus, { label: string; variant: Variant }> = {
  DRAFT: { label: "Draft", variant: "outline" },
  SUBMITTED: { label: "Sent to vendor", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

export const purchaseReturnStatusOptions = (
  Object.keys(statusConfig) as PurchaseReturnStatus[]
).map((value) => ({ value, label: statusConfig[value].label }));

export function PurchaseReturnStatusBadge({ status }: { status: PurchaseReturnStatus }) {
  const c = statusConfig[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export const returnReasonLabels: Record<PurchaseReturnReason, string> = {
  DAMAGED: "Damaged",
  WRONG_ITEM: "Wrong item",
  EXPIRED: "Expired",
  SHORT_SUPPLY: "Short supply",
  QUALITY: "Quality",
  OTHER: "Other",
};

export const returnReasonOptions = (Object.keys(returnReasonLabels) as PurchaseReturnReason[]).map(
  (value) => ({ value, label: returnReasonLabels[value] })
);
