"use client";

import { useMemo, useState } from "react";
import type {
  CustomerStyleItemDto,
  CustomerVariantListItemDto,
  CustomerVariantUnitPriceDto,
} from "@/features/customers/types/catalog.types";

/**
 * The Item page's one piece of state: which Color, and which Size under it.
 *
 * Everything else the page shows is derived from the Color, in the order the
 * catalog models it:
 *
 *   Color -> images -> available Sizes -> stock -> price
 *
 * Picking a Color therefore swaps the gallery and re-points the Size list at
 * that Color's own rows; the previously selected Size is carried over only
 * when the new Color actually sells it (matched by size label, since each
 * Color has its own row - and so its own id - for the same size).
 *
 * Quantity is intentionally not reset when the caller swaps Items: callers
 * that reuse this view for several Items should key the component on the Item
 * id, which resets the whole selection with it.
 */
export interface ItemSelection {
  colors: CustomerVariantListItemDto[];
  selectedColor: CustomerVariantListItemDto | null;
  selectColor: (colorId: string) => void;
  /** Sizes of the selected Color. Empty when this Color is not size-split. */
  sizes: CustomerVariantUnitPriceDto[];
  selectedSize: CustomerVariantUnitPriceDto | null;
  selectSize: (sizeId: string) => void;
  /** True when the Item shows a Color picker at all. */
  hasColors: boolean;
  /** True when the selected Color sells named Sizes (S/M/L), not pack sizes. */
  hasSizes: boolean;
  /** The row that is actually bought: the selected Size of the selected Color. */
  purchasable: CustomerVariantUnitPriceDto | null;
  images: CustomerStyleItemDto["images"];
  inStock: boolean;
  quantity: number;
  setQuantity: (quantity: number) => void;
  /** Null when the selection is complete; otherwise what is still missing. */
  missingSelection: "color" | "size" | null;
}

function isColorSellable(color: CustomerVariantListItemDto): boolean {
  return !color.outOfStock && color.unitPrices.some((up) => up.inStock);
}

/** The Size to land on within a Color: in stock and default, else in stock. */
export function pickSize(
  color: CustomerVariantListItemDto | null,
  preferredLabel?: string | null
): CustomerVariantUnitPriceDto | null {
  const unitPrices = color?.unitPrices ?? [];
  if (unitPrices.length === 0) return null;
  const carriedOver = preferredLabel
    ? unitPrices.find((up) => up.label === preferredLabel && up.inStock)
    : null;
  return (
    carriedOver ??
    unitPrices.find((up) => up.isDefault && up.inStock) ??
    unitPrices.find((up) => up.inStock) ??
    unitPrices.find((up) => up.isDefault) ??
    unitPrices[0] ??
    null
  );
}

/** The Color to land on: in stock and default, else in stock, else the first. */
export function pickColor(
  colors: CustomerVariantListItemDto[]
): CustomerVariantListItemDto | null {
  return colors.find(isColorSellable) ?? colors[0] ?? null;
}

export function useItemSelection(item: CustomerStyleItemDto | null): ItemSelection {
  const colors = useMemo(() => item?.colors ?? [], [item]);

  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  // The selection is derived, not synchronised: the stored id wins while it
  // still names a row this Item has, and otherwise falls back to a sensible
  // default. That covers the first render and the case where the caller swaps
  // in a different Item, without an effect that re-renders to catch up.
  const selectedColor =
    colors.find((color) => color.id === selectedColorId) ?? pickColor(colors);

  const sizes = selectedColor?.unitPrices ?? [];
  const selectedSize =
    sizes.find((size) => size.id === selectedSizeId) ?? pickSize(selectedColor);

  const selectColor = (colorId: string) => {
    const nextColor = colors.find((color) => color.id === colorId) ?? null;
    if (!nextColor) return;
    setSelectedColorId(colorId);
    setSelectedSizeId(pickSize(nextColor, selectedSize?.label)?.id ?? null);
    setQuantity(1);
  };

  const selectSize = (sizeId: string) => {
    const size = sizes.find((s) => s.id === sizeId);
    if (!size || !size.inStock) return;
    setSelectedSizeId(sizeId);
    setQuantity(1);
  };

  // A Color with a named Size attribute (S/M/L) gets the Size picker; one
  // whose rows are pack sizes or a single unnamed row does not.
  const hasSizes = sizes.some((size) => size.sizeId !== null) && sizes.length > 0;
  const hasColors = colors.some((color) => Boolean(color.colorName));

  const images =
    selectedColor && selectedColor.images.length > 0
      ? selectedColor.images
      : (item?.images ?? []);

  const purchasable = selectedSize && selectedSize.inStock ? selectedSize : null;

  return {
    colors,
    selectedColor,
    selectColor,
    sizes,
    selectedSize,
    selectSize,
    hasColors,
    hasSizes,
    purchasable,
    images,
    inStock: Boolean(
      item?.inStock && selectedColor && isColorSellable(selectedColor)
    ),
    quantity,
    setQuantity: (next: number) => setQuantity(Math.max(1, next)),
    missingSelection: !selectedColor && hasColors
      ? "color"
      : hasSizes && !selectedSize
        ? "size"
        : null,
  };
}
