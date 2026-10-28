"use client";

import { useMemo, useState } from "react";
import type {
  CustomerStyleItemDto,
  CustomerVariantListItemDto,
  CustomerVariantUnitPriceDto,
} from "@/features/customers/types/catalog.types";

/**
 * One variation axis a shopper picks from, e.g. Size with S/M/L, or Neck with
 * V-Neck/Round. A value is `available` when some row of the selected Colour sells it
 * alongside the other picks already made - a Round neck that only exists in M should
 * not look selectable once S is chosen.
 */
export interface ItemVariationAttribute {
  attributeId: string;
  attributeName: string;
  values: {
    valueId: string;
    value: string;
    /** Some row reachable from the current picks sells this value. */
    available: boolean;
    /** That row also has stock. */
    inStock: boolean;
  }[];
}

/**
 * The Item page's selection: which Colour, and which value of each variation
 * attribute under it.
 *
 * Everything else the page shows is derived from the Colour, in the order the
 * catalog models it:
 *
 *   Color -> images -> available variations -> stock -> price
 *
 * Picking a Colour therefore swaps the gallery and re-points the variation lists at
 * that Colour's own rows; previous picks are carried over only where the new Colour
 * actually sells them (matched by value label, since each Colour has its own rows -
 * and so its own ids - for the same size).
 *
 * Quantity is intentionally not reset when the caller swaps Items: callers
 * that reuse this view for several Items should key the component on the Item
 * id, which resets the whole selection with it.
 */
export interface ItemSelection {
  colors: CustomerVariantListItemDto[];
  selectedColor: CustomerVariantListItemDto | null;
  selectColor: (colorId: string) => void;
  /** All rows of the selected Colour. Empty when the Item has none. */
  sizes: CustomerVariantUnitPriceDto[];
  /** One entry per variation axis the selected Colour varies on, in a stable order. */
  variationAttributes: ItemVariationAttribute[];
  /** attributeId -> valueId for the picks made so far. */
  selectedValues: Record<string, string>;
  selectValue: (attributeId: string, valueId: string) => void;
  /**
   * Pins one row directly. For pack-size catalogs, whose rows carry no variation
   * values at all and are told apart by their measurement (250g/500g/1kg) - there is
   * no attribute to pick, so `selectValue` cannot express the choice.
   */
  selectUnitPrice: (unitPriceId: string) => void;
  /** True when the Item shows a Color picker at all. */
  hasColors: boolean;
  /** True when the selected Colour varies by named attributes rather than pack sizes. */
  hasVariations: boolean;
  /** The row the current picks resolve to, in stock or not. */
  selectedUnitPrice: CustomerVariantUnitPriceDto | null;
  /** The row that is actually bought: the resolved row, when it has stock. */
  purchasable: CustomerVariantUnitPriceDto | null;
  images: CustomerStyleItemDto["images"];
  inStock: boolean;
  quantity: number;
  setQuantity: (quantity: number) => void;
  /** Null when the selection is complete; otherwise what is still missing. */
  missingSelection: string | null;
}

function isColorSellable(color: CustomerVariantListItemDto): boolean {
  return !color.outOfStock && color.unitPrices.some((up) => up.inStock);
}

/** The row to land on within a Color: in stock and default, else in stock. */
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

/** The picks a row represents, as the selection shape. */
function selectionOf(unitPrice: CustomerVariantUnitPriceDto | null): Record<string, string> {
  const selection: Record<string, string> = {};
  for (const attribute of unitPrice?.attributes ?? []) {
    selection[attribute.attributeId] = attribute.valueId;
  }
  return selection;
}

/** Whether a row carries every pick in `selection` (picks it does not cover are ignored). */
function rowMatches(
  unitPrice: CustomerVariantUnitPriceDto,
  selection: Record<string, string>
): boolean {
  return Object.entries(selection).every(([attributeId, valueId]) =>
    unitPrice.attributes.some((a) => a.attributeId === attributeId && a.valueId === valueId)
  );
}

export function useItemSelection(item: CustomerStyleItemDto | null): ItemSelection {
  const colors = useMemo(() => item?.colors ?? [], [item]);

  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string> | null>(null);
  const [pickedUnitPriceId, setPickedUnitPriceId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  // The selection is derived, not synchronised: the stored ids win while they still
  // name rows this Item has, and otherwise fall back to a sensible default. That
  // covers the first render and the case where the caller swaps in a different Item,
  // without an effect that re-renders to catch up.
  const selectedColor =
    colors.find((color) => color.id === selectedColorId) ?? pickColor(colors);

  const sizes = selectedColor?.unitPrices ?? [];

  // Grouped from the rows themselves, so an axis only appears when this Colour
  // actually varies on it.
  const variationAttributes = useMemo<ItemVariationAttribute[]>(() => {
    const order: string[] = [];
    const byAttribute = new Map<string, { name: string; values: Map<string, string> }>();
    for (const unitPrice of sizes) {
      for (const attribute of unitPrice.attributes) {
        let entry = byAttribute.get(attribute.attributeId);
        if (!entry) {
          entry = { name: attribute.attributeName, values: new Map() };
          byAttribute.set(attribute.attributeId, entry);
          order.push(attribute.attributeId);
        }
        entry.values.set(attribute.valueId, attribute.value);
      }
    }
    return order.map((attributeId) => {
      const entry = byAttribute.get(attributeId)!;
      return {
        attributeId,
        attributeName: entry.name,
        values: [...entry.values].map(([valueId, value]) => ({ valueId, value, available: true, inStock: false })),
      };
    });
  }, [sizes]);

  const hasVariations = variationAttributes.length > 0;

  // A stored pick is kept only while this Colour still sells it.
  const selectedValues = useMemo(() => {
    const fallback = selectionOf(pickSize(selectedColor));
    if (!picked) return fallback;
    const kept: Record<string, string> = {};
    for (const attribute of variationAttributes) {
      const value = picked[attribute.attributeId];
      if (value && attribute.values.some((v) => v.valueId === value)) {
        kept[attribute.attributeId] = value;
      }
    }
    // Nothing carried over (a different Item, or a Colour sharing no values at all),
    // so start from this Colour's own default rather than showing an empty picker.
    return Object.keys(kept).length === 0 ? fallback : kept;
  }, [picked, selectedColor, variationAttributes]);

  // Reachability is judged against the OTHER picks, so a value is only greyed out
  // when nothing sells it alongside them - not merely because it is not picked.
  const attributesWithAvailability = useMemo<ItemVariationAttribute[]>(
    () =>
      variationAttributes.map((attribute) => {
        const others = Object.fromEntries(
          Object.entries(selectedValues).filter(([id]) => id !== attribute.attributeId)
        );
        return {
          ...attribute,
          values: attribute.values.map((value) => {
            const reachable = sizes.filter(
              (up) =>
                rowMatches(up, others) &&
                up.attributes.some(
                  (a) => a.attributeId === attribute.attributeId && a.valueId === value.valueId
                )
            );
            return {
              ...value,
              available: reachable.length > 0,
              inStock: reachable.some((up) => up.inStock),
            };
          }),
        };
      }),
    [variationAttributes, selectedValues, sizes]
  );

  // Every axis answered, and the row carries exactly those values - so a row with an
  // extra axis can never be bought off a partial selection.
  const selectedUnitPrice = useMemo(() => {
    if (!hasVariations) {
      return (
        sizes.find((up) => up.id === pickedUnitPriceId) ?? pickSize(selectedColor)
      );
    }
    if (Object.keys(selectedValues).length < variationAttributes.length) return null;
    return (
      sizes.find(
        (up) =>
          up.attributes.length === variationAttributes.length && rowMatches(up, selectedValues)
      ) ?? null
    );
  }, [hasVariations, selectedColor, selectedValues, sizes, variationAttributes.length]);

  const selectColor = (colorId: string) => {
    const nextColor = colors.find((color) => color.id === colorId) ?? null;
    if (!nextColor) return;
    setSelectedColorId(colorId);
    // The pinned row belonged to the old Colour, so it cannot carry over by id.
    setPickedUnitPriceId(null);
    // Carried over by label, since the same size is a different row - and a different
    // id - under each Colour.
    const labels = new Map(
      (selectedUnitPrice?.attributes ?? []).map((a) => [a.attributeName, a.value])
    );
    const carried: Record<string, string> = {};
    for (const unitPrice of nextColor.unitPrices) {
      for (const attribute of unitPrice.attributes) {
        if (labels.get(attribute.attributeName) === attribute.value) {
          carried[attribute.attributeId] = attribute.valueId;
        }
      }
    }
    setPicked(
      Object.keys(carried).length > 0
        ? carried
        : selectionOf(pickSize(nextColor, selectedUnitPrice?.label))
    );
    setQuantity(1);
  };

  const selectValue = (attributeId: string, valueId: string) => {
    setPicked((prev) => {
      const base = prev ?? selectedValues;
      const next = { ...base, [attributeId]: valueId };
      // Changing one axis can strand the others (Round only in M), so drop any pick
      // that no row sells alongside the new one rather than resolving to nothing.
      for (const attribute of variationAttributes) {
        if (attribute.attributeId === attributeId) continue;
        const candidate = next[attribute.attributeId];
        if (!candidate) continue;
        const stillValid = sizes.some(
          (up) =>
            up.attributes.some((a) => a.attributeId === attributeId && a.valueId === valueId) &&
            up.attributes.some(
              (a) => a.attributeId === attribute.attributeId && a.valueId === candidate
            )
        );
        if (!stillValid) delete next[attribute.attributeId];
      }
      return next;
    });
    setQuantity(1);
  };

  const hasColors = colors.some((color) => Boolean(color.colorName));

  const images =
    selectedColor && selectedColor.images.length > 0
      ? selectedColor.images
      : (item?.images ?? []);

  const purchasable =
    selectedUnitPrice && selectedUnitPrice.inStock ? selectedUnitPrice : null;

  const unanswered = attributesWithAvailability.find(
    (attribute) => !selectedValues[attribute.attributeId]
  );

  return {
    colors,
    selectedColor,
    selectColor,
    sizes,
    variationAttributes: attributesWithAvailability,
    selectedValues,
    selectValue,
    hasColors,
    hasVariations,
    selectedUnitPrice,
    selectUnitPrice: (unitPriceId: string) => {
      if (!sizes.some((up) => up.id === unitPriceId)) return;
      setPickedUnitPriceId(unitPriceId);
      setQuantity(1);
    },
    purchasable,
    images,
    inStock: Boolean(
      item?.inStock && selectedColor && isColorSellable(selectedColor)
    ),
    quantity,
    setQuantity: (next: number) => setQuantity(Math.max(1, next)),
    missingSelection: !selectedColor && hasColors
      ? "colour"
      : unanswered
        ? unanswered.attributeName
        : null,
  };
}
