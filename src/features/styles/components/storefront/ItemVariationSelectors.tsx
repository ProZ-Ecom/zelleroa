"use client";

import type { ItemVariationAttribute } from "../../hooks/use-item-selection";

interface ItemVariationSelectorsProps {
  attributes: ItemVariationAttribute[];
  selectedValues: Record<string, string>;
  onSelect: (attributeId: string, valueId: string) => void;
  /** Shown beside the first heading, e.g. a size guide link. */
  aside?: React.ReactNode;
}

/**
 * One chip row per variation axis the selected Colour varies on - Size, then Neck,
 * then Sleeve - so an item with several axes is picked one axis at a time instead of
 * from a single flat list of every combination.
 *
 * A value no row can reach from the other picks is disabled rather than hidden, so
 * the shopper can tell the option exists and is simply not sold in this combination.
 * Out-of-stock values stay clickable - the page then explains the row is out of
 * stock, which is more useful than a chip that does nothing.
 */
export function ItemVariationSelectors({
  attributes,
  selectedValues,
  onSelect,
  aside,
}: ItemVariationSelectorsProps) {
  if (attributes.length === 0) return null;

  const anyUnavailable = attributes.some((a) => a.values.some((v) => !v.available));

  return (
    <div className="space-y-4">
      {attributes.map((attribute, index) => {
        const selectedValueId = selectedValues[attribute.attributeId];
        return (
          <div key={attribute.attributeId}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--color-neutral-900)]">
                {attribute.attributeName}
                {selectedValueId && (
                  <span className="ml-1.5 font-normal text-[var(--color-neutral-500)]">
                    {attribute.values.find((v) => v.valueId === selectedValueId)?.value}
                  </span>
                )}
              </h3>
              {index === 0 && aside}
            </div>

            <div className="flex flex-wrap gap-2">
              {attribute.values.map((value) => {
                const isSelected = value.valueId === selectedValueId;
                return (
                  <button
                    key={value.valueId}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={
                      value.available
                        ? value.inStock
                          ? value.value
                          : `${value.value} (out of stock)`
                        : `${value.value} (not available)`
                    }
                    disabled={!value.available}
                    onClick={() => onSelect(attribute.attributeId, value.valueId)}
                    className={`min-w-[3rem] rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                      isSelected
                        ? "border-[var(--color-neutral-900)] bg-[var(--color-neutral-900)] text-white"
                        : !value.available
                          ? "border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] text-[var(--color-neutral-300)] line-through"
                          : !value.inStock
                            ? "border-[var(--color-neutral-200)] bg-white text-[var(--color-neutral-400)] line-through"
                            : "border-[var(--color-neutral-300)] bg-white text-[var(--color-neutral-800)] hover:border-[var(--color-neutral-900)]"
                    }`}
                  >
                    <span className="block leading-tight">{value.value}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {anyUnavailable && (
        <p className="text-xs text-[var(--color-neutral-500)]">
          Struck-through options are not sold in the combination you have picked.
        </p>
      )}
    </div>
  );
}

export default ItemVariationSelectors;
