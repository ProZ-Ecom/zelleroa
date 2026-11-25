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
}

function StyleForm({
  initialData,
  isEditing = false,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Style",
}: StyleFormProps) {
  // Same active-brand list (and cache entry) the Product form uses.
  const { data: brandsData, isLoading: isLoadingBrands } = useBrands({ limit: 100 });
  const brandOptions = React.useMemo(
    () => (brandsData?.data ?? []).map((b) => ({ value: b.uuid || String(b.id), label: b.name })),
    [brandsData]
  );

  return (
    <ItemEntityForm
      initialData={initialData}
      brandOptions={brandOptions}
      brandRequired={false}
      brandDescription={
        !isLoadingBrands && brandOptions.length === 0
          ? "No active brands yet - add one on the Brands page first."
          : "Leave blank to use the Product's brand. Only set this when this Style is a different brand."
      }
      isEditing={isEditing}
      isLoading={isLoading}
      submitLabel={submitLabel}
      entityLabel="Style"
      namePlaceholder="e.g. Classic Edition, Slim Fit, Titanium"
      skuPlaceholder="e.g. STY-01"
      codePlaceholder="e.g. classic-edition"
      defaultItemDescription="Auto-selected on the product page"
      showPrice={true}
      priceDescription="Base price for this Style. What a customer pays can also be specified per size or variation."
      onSubmit={(data: ItemEntityFormValues) =>
        onSubmit({ ...data, cookingRecipe: initialData?.cookingRecipe ?? "" })
      }
    />
  );
}

export { StyleForm };
