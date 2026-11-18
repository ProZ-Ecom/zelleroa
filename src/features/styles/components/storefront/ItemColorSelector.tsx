"use client";

import { Check } from "lucide-react";
import { cn, getImageUrl } from "@/lib/utils";
import { ProductImage } from "@/components/common/ProductImage";
import type { CustomerVariantListItemDto } from "@/features/customers/types/catalog.types";

interface ItemColorSelectorProps {
  colors: CustomerVariantListItemDto[];
  selectedColorId: string | null;
  onSelect: (colorId: string) => void;
}

function isSellable(color: CustomerVariantListItemDto): boolean {
  return !color.outOfStock && color.unitPrices.some((up) => up.inStock);
}

/**
 * The Item's Colors. Selecting one drives the whole page - gallery, Sizes,
 * stock and price all follow it. Sold-out Colors stay visible but are struck
 * through, so the shopper can see the Item exists in that Color.
 */
export function ItemColorSelector({
  colors,
  selectedColorId,
  onSelect,
}: ItemColorSelectorProps) {
  if (colors.length === 0) return null;

  const selected = colors.find((color) => color.id === selectedColorId) ?? null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-theme-text-primary">Colour</h3>
        {selected?.colorName && (
          <span className="text-sm font-medium text-theme-primary">{selected.colorName}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Colour">
        {colors.map((color) => {
          const isSelected = color.id === selectedColorId;
          const sellable = isSellable(color);
          const label = color.colorName || color.variantName || "Colour";
          const swatchImage = color.images[0]?.imageUrl ?? color.primaryImage;

          return (
            <button
              key={color.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={sellable ? label : `${label} (out of stock)`}
              title={label}
              onClick={() => onSelect(color.id)}
              className={cn(
                "relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 cursor-pointer",
                isSelected
                  ? "border-theme-primary shadow-lg shadow-theme-primary/25 scale-[1.03]"
                  : "border-theme-border hover:border-theme-primary/50 hover:shadow-md hover:-translate-y-0.5",
                !sellable && "opacity-50"
              )}
            >
              {swatchImage ? (
                <ProductImage
                  src={getImageUrl(swatchImage)}
                  alt={label}
                  fallbackText={label}
                  containerClassName="w-full h-full"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="block h-full w-full"
                  style={{ backgroundColor: color.colorHex || "var(--theme-surface-alt)" }}
                />
              )}

              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm">
                    <Check className="h-3 w-3 text-theme-primary" strokeWidth={3} />
                  </span>
                </span>
              )}
              {!sellable && (
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(to_top_right,transparent_47%,currentColor_47%,currentColor_53%,transparent_53%)] text-theme-text-subtle"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ItemColorSelector;
