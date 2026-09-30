"use client";

import React from "react";
import { useBrands } from "@/features/brands/hooks";
import {
  ItemEntityForm,
  type ItemEntityFormValues,
} from "@/components/forms/item-entity-form";

// One sellable style/design under a Product (e.g. Product "T-Shirt" -> Item
// "V Neck T-Shirt", "Solo T-Shirt"). Color/Size splits live one level down,
// managed separately via VariantForm/VariantGenerator once the Item exists.
//
// Fields come from the shared ItemEntityForm so the "Add Item" modal on the
// Item List page, on the Product page and the sub-variant one all ask for the
// same things. cookingRecipe has no field of its own - it is carried through
// untouched so an edit never wipes a recipe saved elsewhere.
export type StyleFormValues = ItemEntityFormValues & {
  cookingRecipe?: string;
};

interface StyleFormProps {
  initialData?: Partial<StyleFormValues>;
  isEditing?: boolean;
  onSubmit: (data: StyleFormValues) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
  /** Brand pre-selected on a new Item - normally the parent Product's brand. */
  defaultBrandId?: string | null;
}

function StyleForm({
  initialData,
  isEditing = false,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Item",
  defaultBrandId,
}: StyleFormProps) {
  // Same active-brand list (and cache entry) the Product form uses.
  const { data: brandsData, isLoading: isLoadingBrands } = useBrands({ limit: 100 });
  const brandOptions = React.useMemo(
    () => (brandsData?.data ?? []).map((b) => ({ value: b.uuid || String(b.id), label: b.name })),
    [brandsData]
  );

  const formInitialData = React.useMemo(
    () =>
      !initialData?.brandId && defaultBrandId
        ? { ...initialData, brandId: defaultBrandId }
        : initialData,
    [initialData, defaultBrandId]
  );

  return (
    <ItemEntityForm
      initialData={formInitialData}
      brandOptions={brandOptions}
      brandDescription={
        !isLoadingBrands && brandOptions.length === 0
          ? "No active brands yet - add one on the Brands page first."
          : undefined
      }
      isEditing={isEditing}
      isLoading={isLoading}
      submitLabel={submitLabel}
      namePlaceholder="e.g. V Neck T-Shirt, Solo T-Shirt"
      skuPlaceholder="e.g. TSHIRT-VNECK"
      codePlaceholder="e.g. v-neck-t-shirt"
      defaultItemDescription="Auto-selected on the product page"
      showPrice={false}
      onSubmit={(data: ItemEntityFormValues) =>
        onSubmit({ ...data, cookingRecipe: initialData?.cookingRecipe ?? "" })
      }
    />
  );
}

export { StyleForm };
