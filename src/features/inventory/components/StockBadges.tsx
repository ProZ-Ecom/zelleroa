import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MovementType, StockItemLabel, StockStatus } from "../types/stock";

const movementStyles: Record<MovementType, string> = {
  PURCHASE: "bg-blue-100 text-blue-800",
  SALE: "bg-green-100 text-green-800",
  RETURN: "bg-orange-100 text-orange-800",
  REPLACEMENT: "bg-indigo-100 text-indigo-800",
  ADJUSTMENT: "bg-purple-100 text-purple-800",
  PURCHASE_RETURN: "bg-amber-100 text-amber-900",
  DAMAGE: "bg-red-100 text-red-800",
};

/** "PURCHASE_RETURN" reads as "Purchase return", not "Purchase_return". */
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  PURCHASE: "Purchase",
  SALE: "Sale",
  RETURN: "Return",
  REPLACEMENT: "Replacement",
  ADJUSTMENT: "Adjustment",
  PURCHASE_RETURN: "Purchase return",
  DAMAGE: "Damage",
};

export function MovementTypeBadge({ type }: { type: MovementType | null }) {
  if (!type) return <Badge variant="outline">Legacy</Badge>;
  return (
    <Badge className={cn("border-transparent", movementStyles[type])}>
      {MOVEMENT_LABELS[type]}
    </Badge>
  );
}

export function StockStatusBadge({ status }: { status: StockStatus }) {
  if (status === "out_of_stock") return <Badge variant="destructive">Out of stock</Badge>;
  if (status === "low_stock") return <Badge variant="warning">Low stock</Badge>;
  return <Badge variant="success">In stock</Badge>;
}

/** Product on the first line, colour / size / SKU underneath. */
export function VariantLabel({ item }: { item: StockItemLabel }) {
  const detail = [
    item.itemName && item.itemName !== item.productName ? item.itemName : null,
    item.colorName,
    item.sizeName,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div>
      <p className="font-medium text-[var(--color-neutral-900)]">{item.productName}</p>
      <p className="text-xs text-[var(--color-neutral-500)]">
        {detail || "Default"} · {item.sku}
      </p>
    </div>
  );
}

export function SignedQuantity({ value }: { value: number }) {
  return (
    <span className={cn("font-semibold tabular-nums", value < 0 ? "text-red-600" : "text-green-700")}>
      {value > 0 ? `+${value}` : value}
    </span>
  );
}
