"use client";

import React, { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import type { SelectOption } from "@/components/ui/select";
import { FormTextarea } from "@/components/forms/form-textarea";
import { FormRichText } from "@/components/forms/form-rich-text";
import { FormCheckbox } from "@/components/forms/form-checkbox";
import { FormSubmitButton } from "@/components/forms/form-submit-button";

// The single Item create/edit form. Both levels the admin calls an "Item" -
// the sellable Style under a Product ("V Neck T-Shirt") and the admin-only
// sub-variant under a Style ("Regular Fit") - render through this component so
// the two "Add Item" modals always ask for the same fields, in the same order,
// with the same labels and validation. Only the example placeholders and the
// "Default Item" hint differ, and those come in as props.
export const itemEntityFormSchema = z.object({
  // Brand UUID. Only asked for when brandOptions is passed (the Style level);
  // brandedItemEntityFormSchema below makes it required there.
  brandId: z.string().optional(),
  name: z
    .string({ message: "Item name is required" })
    .trim()
    .min(1, "Item name cannot be empty")
    .max(200, "Item name cannot exceed 200 characters"),
  slug: z
    .string({ message: "Item code is required" })
    .trim()
    .min(1, "Item code cannot be empty")
    .max(220, "Item code cannot exceed 220 characters"),
  sku: z.string().trim().max(100, "SKU cannot exceed 100 characters").optional(),
  shortDescription: z
    .string()
    .trim()
    .max(500, "Short description cannot exceed 500 characters")
    .optional(),
  description: z.string().trim().optional(),
  // FormInput hands back "" when a number field is cleared, so the message
  // here doubles as the "required" message instead of zod's raw type error.
  basePrice: z
    .number({ message: "Base price is required" })
    .min(0, "Base price cannot be negative"),
  isFeatured: z.boolean(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean(),
});

export type ItemEntityFormValues = z.infer<typeof itemEntityFormSchema>;

// When the price is shown it is the Item's one selling price, so it must be set.
const pricedItemEntityFormSchema = itemEntityFormSchema.extend({
  basePrice: z
    .number({ message: "Price is required" })
    .gt(0, "Price must be more than 0"),
});

const brandRequired = {
  brandId: z.string({ message: "Brand is required" }).min(1, "Brand is required"),
};

function pickSchema(showPrice: boolean, showBrand: boolean) {
  const base = showPrice ? pricedItemEntityFormSchema : itemEntityFormSchema;
  return showBrand ? base.extend(brandRequired) : base;
}

export interface ItemEntityFormProps {
  initialData?: Partial<ItemEntityFormValues>;
  isEditing?: boolean;
  onSubmit: (data: ItemEntityFormValues) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
  /** Example name shown in the Item Name field, e.g. "V Neck T-Shirt". */
  namePlaceholder?: string;
  skuPlaceholder?: string;
  codePlaceholder?: string;
  /** Where this Item gets auto-selected when it is the default. */
  defaultItemDescription?: string;
  /**
   * Only the admin-only Item (e.g. "Regular Fit") asks for a price: it is the
   * one price every Color x Size under it sells at. A Style never asks - its
   * "from" price is the cheapest of its Items' sizes.
   */
  showPrice?: boolean;
  /**
   * Active brands to pick from. Passing this shows a required Brand field -
   * every sellable Item belongs to one Brand. Omitted for the sub-variant form.
   */
  brandOptions?: SelectOption[];
  /** Help text under the Brand field, e.g. when no active brands exist yet. */
  brandDescription?: string;
  /** What the admin calls this level in labels - "Item" or "Type". */
  entityLabel?: string;
  /**
   * Admin-only levels (the Model) never reach customers, so they skip the
   * storefront copy fields: descriptions and "Featured".
   */
  compact?: boolean;
}

function toItemCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDefaults(initialData?: Partial<ItemEntityFormValues>): ItemEntityFormValues {
  return {
    brandId: initialData?.brandId || "",
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    sku: initialData?.sku || "",
    shortDescription: initialData?.shortDescription || "",
    description: initialData?.description || "",
    basePrice: initialData?.basePrice ?? 0,
    isFeatured: initialData?.isFeatured ?? false,
    isDefault: initialData?.isDefault ?? false,
    isActive: initialData?.isActive ?? false,
  };
}

function ItemEntityForm({
  initialData,
  isEditing: _isEditing = false,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Item",
  namePlaceholder = "e.g. V Neck T-Shirt, Solo T-Shirt",
  skuPlaceholder = "e.g. TSHIRT-VNECK",
  codePlaceholder = "e.g. v-neck-t-shirt",
  defaultItemDescription = "Auto-selected on the product page",
  showPrice = true,
  brandOptions,
  brandDescription,
  entityLabel = "Item",
  compact = false,
}: ItemEntityFormProps) {
  const entityLower = entityLabel.toLowerCase();
  const showBrand = Boolean(brandOptions);
  const [codeTouched, setCodeTouched] = React.useState<boolean>(() => Boolean(initialData?.slug));

  const methods = useForm<ItemEntityFormValues>({
    resolver: zodResolver(pickSchema(showPrice, showBrand)),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: buildDefaults(initialData),
  });

  const watchedName = methods.watch("name");

  // Fill in the code from the Item Name automatically, same convention as
  // VariantForm's Item Code field - stops as soon as the admin edits it by hand.
  useEffect(() => {
    if (codeTouched) return;
    methods.setValue("slug", toItemCode(watchedName || ""), {
      shouldValidate: methods.formState.isSubmitted,
    });
  }, [watchedName, codeTouched, methods]);

  useEffect(() => {
    if (initialData) {
      methods.reset(buildDefaults(initialData));
      setCodeTouched(Boolean(initialData.slug));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  const handleSlugChange = (raw: string) => {
    setCodeTouched(true);
    methods.setValue(
      "slug",
      raw
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]+/g, ""),
      { shouldValidate: true, shouldDirty: true }
    );
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        {showBrand && (
          <FormSelect
            name="brandId"
            label="Brand"
            placeholder="Select brand"
            options={brandOptions ?? []}
            description={brandDescription}
            required
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput name="name" label={`${entityLabel} Name`} placeholder={namePlaceholder} required />
          {showPrice && (
            <FormInput
              name="basePrice"
              type="number"
              label="Price (₹)"
              placeholder="e.g. 599"
              description={`What customers pay for every color and size of this ${entityLower}. Only sizes that cost more or less need their own price later.`}
              required
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput name="sku" label={`${entityLabel} SKU (optional)`} placeholder={skuPlaceholder} />
          <div>
            <label className="block text-xs font-semibold text-[var(--color-neutral-800)] mb-1.5">
              {entityLabel} Code (fills in automatically) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={methods.watch("slug")}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder={codePlaceholder}
              className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm font-mono bg-white outline-none focus:border-secondary-600 focus:ring-2 focus:ring-secondary-600/20"
            />
            {methods.formState.errors.slug && (
              <p className="mt-1 text-xs text-red-500 font-medium">
                {methods.formState.errors.slug.message}
              </p>
            )}
          </div>
        </div>

        {!compact && (
          <>
            <FormTextarea
              name="shortDescription"
              label="Short Description"
              placeholder={`Brief summary of the ${entityLower} (max 500 characters)`}
              rows={2}
            />

            <FormRichText
              name="description"
              label={`${entityLabel} Description`}
              placeholder={`Detailed ${entityLower} information and description`}
            />
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!compact && (
            <FormCheckbox
              name="isFeatured"
              label={`Featured ${entityLabel}`}
              description="Display prominently in featured sections"
            />
          )}
          <FormCheckbox
            name="isDefault"
            label={`Default ${entityLabel}`}
            description={defaultItemDescription}
          />
        </div>

        <FormCheckbox
          name="isActive"
          label="Status: Active"
          description={`Inactive ${entityLower}s are hidden from customers`}
        />

        <div className="flex justify-end pt-2">
          <FormSubmitButton
            isLoading={isLoading}
            className="h-11 rounded-xl bg-[var(--color-secondary-600)] px-6 text-sm font-semibold text-white hover:bg-[var(--color-secondary-700)]"
          >
            {submitLabel}
          </FormSubmitButton>
        </div>
      </form>
    </FormProvider>
  );
}

export { ItemEntityForm };
