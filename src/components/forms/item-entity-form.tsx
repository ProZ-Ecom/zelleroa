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
import { QuickAddBrandModal } from "@/features/brands/components/QuickAddBrandModal";
import { toast } from "@/components/ui/Toast";

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
  // When price is not shown, basePrice is optional and defaults to 0.
  basePrice: z
    .union([z.number(), z.string(), z.undefined()])
    .optional()
    .transform((val) => {
      if (typeof val === "number") return val;
      if (!val || val === "") return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    }),
  isFeatured: z.boolean(),
  // Storefront "New" badge. Set by hand so a bulk upload doesn't flag everything.
  isNewArrival: z.boolean().optional(),
  // YYYY-MM-DD; blank = no expiry.
  newArrivalUntil: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean(),
  outOfStock: z.boolean().optional(),
});

export type ItemEntityFormValues = z.infer<typeof itemEntityFormSchema>;

// When the price is shown it is the Item's one selling price, so it must be set.
const pricedItemEntityFormSchema = itemEntityFormSchema.extend({
  basePrice: z
    .union([z.number(), z.string()])
    .refine(
      (val) => {
        if (val === "" || val === undefined || val === null) return false;
        const num = typeof val === "number" ? val : Number(val);
        return !isNaN(num) && num >= 0;
      },
      { message: "Price is required and cannot be negative" }
    )
    .transform((val) => (typeof val === "number" ? val : Number(val))),
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
  /**
   * "slug" is lowercase-with-hyphens (default); "constant" is UPPER_SNAKE_CASE
   * (uppercase letters, digits and underscores only), used for Model codes.
   */
  codeFormat?: "slug" | "constant";
}

function toItemCode(raw: string, format: "slug" | "constant" = "slug"): string {
  if (format === "constant") {
    return raw
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDefaults(
  initialData?: Partial<ItemEntityFormValues>,
  showPrice: boolean = true
): ItemEntityFormValues {
  return {
    brandId: initialData?.brandId || "",
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    sku: initialData?.sku || "",
    shortDescription: initialData?.shortDescription || "",
    description: initialData?.description || "",
    basePrice: initialData?.basePrice ?? (showPrice ? ("" as unknown as number) : 0),
    isFeatured: initialData?.isFeatured ?? false,
    isNewArrival: initialData?.isNewArrival ?? false,
    newArrivalUntil: initialData?.newArrivalUntil ?? "",
    isDefault: initialData?.isDefault ?? false,
    isActive: initialData?.isActive ?? false,
    outOfStock: initialData?.outOfStock ?? false,
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
  codeFormat = "slug",
}: ItemEntityFormProps) {
  const entityLower = entityLabel.toLowerCase();
  const showBrand = Boolean(brandOptions);
  const [codeTouched, setCodeTouched] = React.useState<boolean>(() => Boolean(initialData?.slug));
  const [isAddBrandOpen, setIsAddBrandOpen] = React.useState(false);
  // Brands created from this form; kept locally so the Select can show the new
  // one before the parent's brand list refetches.
  const [createdBrands, setCreatedBrands] = React.useState<SelectOption[]>([]);
  const allBrandOptions = React.useMemo(() => {
    const base = brandOptions ?? [];
    return [...base, ...createdBrands.filter((c) => !base.some((b) => b.value === c.value))];
  }, [brandOptions, createdBrands]);

  const methods = useForm<ItemEntityFormValues>({
    resolver: zodResolver(pickSchema(showPrice, showBrand) as any) as any,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: buildDefaults(initialData, showPrice),
  });

  const watchedName = methods.watch("name");

  // Fill in the code from the Item Name automatically, same convention as
  // VariantForm's Item Code field - stops as soon as the admin edits it by hand.
  useEffect(() => {
    if (codeTouched) return;
    methods.setValue("slug", toItemCode(watchedName || "", codeFormat), {
      shouldValidate: methods.formState.isSubmitted,
    });
  }, [watchedName, codeTouched, codeFormat, methods]);

  useEffect(() => {
    if (initialData) {
      methods.reset(buildDefaults(initialData, showPrice));
      setCodeTouched(Boolean(initialData.slug));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, showPrice]);

  const handleSlugChange = (raw: string) => {
    setCodeTouched(true);
    const cleaned =
      codeFormat === "constant"
        ? raw
          .toUpperCase()
          .replace(/[\s-]+/g, "_")
          .replace(/[^A-Z0-9_]+/g, "")
        : raw
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]+/g, "");
    methods.setValue("slug", cleaned, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit, (errors) => {
          console.error("Item form validation errors:", errors);
          const firstErrorKey = Object.keys(errors)[0];
          const firstError = errors[firstErrorKey as keyof ItemEntityFormValues];
          if (firstError?.message) {
            toast.error("Please fill in required fields", firstError.message);
          }
          const el =
            document.querySelector(`[name="${firstErrorKey}"]`) ||
            document.getElementById(firstErrorKey);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        })}
        className="space-y-6"
      >
        {showBrand && (
          <FormSelect
            name="brandId"
            label="Brand"
            placeholder="Select brand"
            options={allBrandOptions}
            description={brandDescription}
            searchable
            required
            labelAction={
              <button
                type="button"
                onClick={() => setIsAddBrandOpen(true)}
                className="text-xs font-semibold text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)] cursor-pointer"
              >
                + Add brand
              </button>
            }
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput name="name" label={`${entityLabel} Name`} placeholder={namePlaceholder} required />
          {showPrice && (
            <FormInput
              name="basePrice"
              type="number"
              label="Price (₹)"
              placeholder="0"
              onFocus={(e) => e.target.select()}
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

        {!compact && (
          <div className="space-y-3">
            <FormCheckbox
              name="isNewArrival"
              label="New Arrival"
              description="Shows the NEW badge on the storefront. Untick (or set an end date) to stop it."
            />
            {methods.watch("isNewArrival") && (
              <FormInput
                name="newArrivalUntil"
                type="date"
                label="Show as New until (optional)"
                description="Leave blank to keep the badge until you untick it."
              />
            )}
          </div>
        )}

        <FormCheckbox
          name="isActive"
          label="Status: Active"
          description={`Inactive ${entityLower}s are hidden from customers`}
        />

        <div className="flex justify-end pt-2">
          <FormSubmitButton
            isLoading={isLoading}
            className="h-11 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-6 text-sm font-semibold text-white transition-colors"
          >
            {submitLabel}
          </FormSubmitButton>
        </div>
      </form>

      {showBrand && (
        <QuickAddBrandModal
          open={isAddBrandOpen}
          onClose={() => setIsAddBrandOpen(false)}
          onCreated={(brand) => {
            setCreatedBrands((prev) => [...prev, brand]);
            methods.setValue("brandId", brand.value, { shouldValidate: true, shouldDirty: true });
          }}
        />
      )}
    </FormProvider>
  );
}

export { ItemEntityForm };
