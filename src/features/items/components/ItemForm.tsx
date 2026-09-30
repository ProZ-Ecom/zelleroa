"use client";

import React from "react";
import {
  ItemEntityForm,
  type ItemEntityFormValues,
} from "@/components/forms/item-entity-form";

// The admin-only sub-variant (called "Type" in the UI) under a Style (e.g. Style "V Neck T-Shirt" -> Item
// "Regular Fit", "Slim Fit", "Oversized"). Never shown to customers. Color/Size
// splits live one/two levels down, managed separately via VariantForm/
// VariantGenerator once the Item exists.
//
// Fields come from the shared ItemEntityForm so this stays field-for-field
// identical to the Item form on the Item List / Product pages.
export type ItemFormValues = ItemEntityFormValues;

interface ItemFormProps {
  initialData?: Partial<ItemFormValues>;
  isEditing?: boolean;
  onSubmit: (data: ItemFormValues) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

function ItemForm({
  initialData,
  isEditing = false,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Type",
}: ItemFormProps) {
  return (
    <ItemEntityForm
      initialData={initialData}
      isEditing={isEditing}
      onSubmit={onSubmit}
      isLoading={isLoading}
      submitLabel={submitLabel}
      namePlaceholder="e.g. Regular Fit, Slim Fit, Oversized"
      skuPlaceholder="e.g. TSHIRT-VNECK-REGULAR"
      codePlaceholder="e.g. regular-fit"
      defaultItemDescription="Auto-selected on the item page"
      entityLabel="Model"
      compact
    />
  );
}

export { ItemForm };
