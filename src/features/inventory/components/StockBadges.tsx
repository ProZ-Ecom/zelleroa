import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MovementType, StockItemLabel, StockStatus } from "../types/stock";

const movementStyles: Record<MovementType, string> = {
  PURCHASE: "bg-blue-100 text-blue-800",
  SALE: "bg-green-100 text-green-800",
  RETURN: "bg-orange-100 text-orange-800",
  REPLACEMENT: "bg-indigo-100 text-indigo-800",
  ADJUSTMENT: "bg-purple-100 text-purple-800",
};

export function MovementTypeBadge({ type }: { type: MovementType | null }) {
  if (!type) return <Badge variant="outline">Legacy</Badge>;
  return (
    <Badge className={cn("border-transparent", movementStyles[type])}>
      {type.charAt(0) + type.slice(1).toLowerCase()}
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
