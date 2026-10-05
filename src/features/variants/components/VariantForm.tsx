"use client";

import React, { useMemo, useEffect, useState, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, ChevronDown } from "lucide-react";
import type { UnitOption } from "../types";
import { FormSelect } from "@/components/forms/form-select";
import { FormCheckbox } from "@/components/forms/form-checkbox";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { useConfiguredAttributesForProduct } from "@/features/attributes/hooks/use-attributes";
import { useSizeChart } from "@/features/size-charts/hooks/use-size-chart";
import type { SizeChartGender } from "@/features/size-charts/types";

// Item-level fields only. Unit + price combinations (sku, unit, base price)
// are managed separately per (unit) via VariantUnitPriceList, since one item
// can now be sold in multiple sizes at different prices.
const variantFormSchema = z.object({
  productId: z
    .string()
    .optional()
    .refine((val) => !val || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val), {
      message: "Please select a product",
    }),
  variantName: z
    .string()
    .trim()
    .optional(),
  slug: z
    .string({ message: "Item code is required" })
    .trim()
    .min(1, "Item code cannot be empty")
    .max(255, "Item code cannot exceed 255 characters"),
  priceAdjustment: z.number().optional(),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
  attributeValueIds: z.array(z.string().uuid()).optional(),
});

export type VariantFormValues = z.infer<typeof variantFormSchema>;

export interface SelectOption {
  value: string;
  label: string;
  slug?: string; // Product Code
  categoryId?: string | null;
  gender?: SizeChartGender | null;
}

export type UnitFormItem = UnitOption | (SelectOption & {
  id?: string;
  type?: "weight" | "volume" | "count";
  code?: string;
  name?: string;
  conversionFactor?: number;
});

interface VariantFormProps {
  initialData?: Partial<VariantFormValues>;
  isEditing?: boolean;
  fixedProductId?: string;
  fixedProductSlug?: string;
  /** Category UUID of the (fixed or selected) product, used to fetch its configured attributes. */
  categoryUuid?: string | null;
  /** The product's audience - the Size attribute's options are the category+gender size chart. */
  productGender?: SizeChartGender | null;
  products?: SelectOption[];
  onSubmit: (data: VariantFormValues) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

function VariantForm({
  initialData,
  isEditing = false,
  fixedProductId,
  fixedProductSlug,
  categoryUuid,
  productGender,
  products = [],
  onSubmit,
  isLoading = false,
  submitLabel = "Save Item",
}: VariantFormProps) {
  // Helper to compute prefix from Product Code / Slug
  const computePrefix = (prodId?: string): string => {
    if (fixedProductSlug) {
      return `${fixedProductSlug.toUpperCase().trim()}_`;
    }
    const p = products.find((item) => item.value === prodId);
    const pSlug = p?.slug?.trim() || "";
    if (pSlug) {
      return `${pSlug.toUpperCase()}_`;
    }
    return "";
  };

  const initialProductId = fixedProductId || initialData?.productId || "";
  const initialPrefix = computePrefix(initialProductId);

  const extractInitialExtraSlug = (fullSlug?: string, prefix?: string): string => {
    if (!fullSlug) return "";
    if (prefix && fullSlug.startsWith(prefix)) {
      return fullSlug.slice(prefix.length);
    }
    return fullSlug.replace(/\s+/g, "_").toUpperCase();
  };

  const [extraSlug, setExtraSlug] = useState<string>(() =>
    extractInitialExtraSlug(initialData?.slug, initialPrefix)
  );
  // Once the admin edits the code by hand, stop auto-filling it from the Item
  // Name so we never silently overwrite a deliberate choice. Editing an
  // existing item (which already has a slug) counts as "already set".
  const [codeTouched, setCodeTouched] = useState<boolean>(() => Boolean(initialData?.slug));
  const [extraSlugError, setExtraSlugError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showInfo) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setShowInfo(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showInfo]);

  const methods = useForm<VariantFormValues>({
    resolver: zodResolver(variantFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      productId: fixedProductId || initialData?.productId || "",
      variantName: initialData?.variantName || "",
      slug: initialData?.slug || "",
      priceAdjustment: initialData?.priceAdjustment ?? 0,
      isFeatured: initialData?.isFeatured ?? false,
      isActive: initialData?.isActive ?? true,
      attributeValueIds: initialData?.attributeValueIds || [],
    },
  });

  const selectedProductId = methods.watch("productId");
  const watchedVariantName = methods.watch("variantName");
  const watchedAttributeValueIds = methods.watch("attributeValueIds") || [];

  // categoryUuid/productGender come from the caller when the product is fixed
  // (e.g. adding an Item from within a Product's own page); otherwise fall
  // back to whichever product the admin just picked in the dropdown above.
  const selectedProduct = products.find(
    (item) => item.value === (fixedProductId || selectedProductId)
  );
  const effectiveProductId = fixedProductId || selectedProductId || null;
  const effectiveCategoryUuid = categoryUuid ?? selectedProduct?.categoryId ?? null;
  const effectiveProductGender = productGender ?? selectedProduct?.gender ?? null;

  // Attribute values come from the Product's own configured attributes (Color,
  // Size, Material...) - never from the category - so Color is just another
  // attribute here, entirely driven by the Attribute Master.
  const { data: productAttributes = [] } = useConfiguredAttributesForProduct(effectiveProductId);
  const { data: sizeChart = [] } = useSizeChart(effectiveCategoryUuid, effectiveProductGender);

  // Derive readable variant name (e.g. "Emerald Green", "Red") from selected color/attribute values (excluding size, which is added per-unit)
  const selectedAttributeNames = useMemo(() => {
    if (!watchedAttributeValueIds.length || !productAttributes.length) return "";
    const names: string[] = [];
    for (const attr of productAttributes) {
      if (attr.name.trim().toLowerCase() === "size") continue;
      const match = attr.values.find((v) => watchedAttributeValueIds.includes(v.id));
      if (match) {
        names.push(match.value);
      }
    }
    return names.join(" / ");
  }, [watchedAttributeValueIds, productAttributes]);

  const handleAttributeValueChange = (
    attributeValueIdsForAttribute: string[],
    newValueId: string
  ) => {
    const current = methods.getValues("attributeValueIds") || [];
    const withoutThisAttribute = current.filter(
      (id) => !attributeValueIdsForAttribute.includes(id)
    );
    methods.setValue(
      "attributeValueIds",
      newValueId ? [...withoutThisAttribute, newValueId] : withoutThisAttribute,
      { shouldValidate: true, shouldDirty: true }
    );
  };

  // Dynamic non-editable prefix based on currently selected Product
  const slugPrefix = useMemo(
    () => computePrefix(selectedProductId || fixedProductId),
    [selectedProductId, fixedProductId, fixedProductSlug, products]
  );

  // Sync combined variant code into form state whenever prefix or extraSlug updates
  useEffect(() => {
    const fullSlug = `${slugPrefix}${extraSlug}`.trim();
    methods.setValue("slug", fullSlug, {
      shouldValidate: methods.formState.isSubmitted,
    });
  }, [slugPrefix, extraSlug, methods]);

  // Fill in the Item Code from selected attribute values automatically, so most admins
  // never have to think about it. Stops as soon as they edit the code by hand.
  useEffect(() => {
    if (codeTouched) return;
    const source = selectedAttributeNames || watchedVariantName || initialData?.variantName || "";
    const auto = source
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    setExtraSlug(auto);
  }, [selectedAttributeNames, watchedVariantName, initialData?.variantName, codeTouched]);

  useEffect(() => {
    if (initialData) {
      methods.reset({
        productId: fixedProductId || initialData.productId || "",
        variantName: initialData.variantName || "",
        slug: initialData.slug || "",
        priceAdjustment: initialData.priceAdjustment ?? 0,
        isFeatured: initialData.isFeatured ?? false,
        isActive: initialData.isActive ?? true,
        attributeValueIds: initialData.attributeValueIds || [],
      });

      setExtraSlug(extractInitialExtraSlug(initialData.slug, initialPrefix));
      setCodeTouched(Boolean(initialData.slug));
    }
  }, [initialData, fixedProductId, initialPrefix, methods]);

  const productOptions = useMemo(
    () => products,
    [products]
  );

  const handleExtraSlugChange = (raw: string) => {
    // Format variant code: uppercase, convert spaces to underscore, allow special characters
    const formatted = raw
      .toUpperCase()
      .replace(/\s+/g, "_");
    setExtraSlug(formatted);
    setCodeTouched(true);
    if (extraSlugError) setExtraSlugError(null);
    methods.clearErrors("slug");
  };

  const handleFormSubmit = async (data: VariantFormValues) => {
    if (!fixedProductId && !data.productId) {
      methods.setError("productId", { message: "Please select a product" });
      return;
    }

    const derivedVariantName =
      selectedAttributeNames ||
      data.variantName ||
      initialData?.variantName ||
      "Default";

    const autoExtra = derivedVariantName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "COLOR";

    const effectiveExtraSlug = extraSlug.trim() || autoExtra;
    const finalSlug = (isEditing && !codeTouched && initialData?.slug)
      ? initialData.slug
      : `${slugPrefix}${effectiveExtraSlug}`;

    const submissionPayload: VariantFormValues = {
      ...data,
      variantName: derivedVariantName,
      slug: finalSlug,
    };

    await onSubmit(submissionPayload);
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(handleFormSubmit)}
        className="space-y-6"
      >
        {/* Product selection (if product is not fixed) */}
        {!fixedProductId && (
          <FormSelect
            name="productId"
            label="Product"
            placeholder="Select product"
            options={productOptions}
            required
          />
        )}

        {/* 1. Attribute Values (Color, Fabric, etc. — excluding Size, which is managed in the Sizes & Pricing step) */}
        {(() => {
          const visibleAttributes = productAttributes
            .filter((attribute) => attribute.name.trim().toLowerCase() !== "size")
            .filter((attribute) => attribute.values.length > 0);

          if (visibleAttributes.length === 0) {
            return (
              <p className="text-xs text-neutral-400 italic">
                {effectiveProductId
                  ? "This product has no attributes configured yet. Configure Color, Size, etc. under the product's Attributes section first."
                  : "Select a product to see its configured attributes."}
              </p>
            );
          }

          return (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-neutral-800)] mb-1.5">
                Select Variation Attributes
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleAttributes.map((attribute) => {
                  const valueIdsForAttribute = attribute.values.map((v) => v.id);
                  const selectedValueId =
                    watchedAttributeValueIds.find((id) =>
                      valueIdsForAttribute.includes(id)
                    ) || "";
                  const isColor = attribute.type === "color";
                  const selectedValue = attribute.values.find((v) => v.id === selectedValueId) as
                    | { colorHex?: string | null }
                    | undefined;

                  return (
                    <div key={attribute.id}>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">
                        {attribute.name}
                        {attribute.isRequired && <span className="text-red-500"> *</span>}
                      </label>
                      <div className="flex items-center gap-2">
                        {isColor && (
                          <span
                            className="h-6 w-6 shrink-0 rounded-full border border-neutral-200"
                            style={{ backgroundColor: selectedValue?.colorHex || "#e5e5e5" }}
                            title={selectedValue?.colorHex || undefined}
                          />
                        )}
                        <select
                          value={selectedValueId}
                          onChange={(e) =>
                            handleAttributeValueChange(valueIdsForAttribute, e.target.value)
                          }
                          className="w-full h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-secondary-600 focus:ring-2 focus:ring-secondary-600/20"
                        >
                          <option value="">Select {attribute.name}</option>
                          {attribute.values.map((value) => (
                            <option key={value.id} value={value.id}>
                              {value.value}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 2. Secondary / Advanced Options (Item Code, Featured). A color never
            carries a price of its own - price lives on the Item, and on a
            size row only when that size costs more or less. */}
        <details className="group rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 font-sans text-xs">
          <summary className="flex items-center justify-between font-semibold text-neutral-700 cursor-pointer select-none">
            <span>Advanced Options (Item Code, Featured)</span>
            <ChevronDown className="h-4 w-4 text-neutral-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-4 space-y-4 pt-3 border-t border-neutral-200/60">
            {/* Item Code with Category + Product Code Prefix & Info Pop-Up */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="block text-xs font-semibold text-[var(--color-neutral-800)]">
                  Item Code (fills in automatically) <span className="text-red-500">*</span>
                </label>
                <div className="relative inline-flex items-center" ref={infoRef}>
                  <button
                    type="button"
                    onClick={() => setShowInfo((prev) => !prev)}
                    className="text-neutral-400 hover:text-[var(--color-secondary-600)] transition-colors focus:outline-none cursor-pointer rounded-full p-0.5"
                    title="Click for more information"
                    aria-label="Information"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>

                  {showInfo && (
                    <div className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 rounded-xl bg-white border border-neutral-200/90 p-3 text-xs text-neutral-700 shadow-xl shadow-neutral-900/10 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-[var(--color-secondary-600)] shrink-0 mt-0.5" />
                          <p className="leading-relaxed text-[var(--color-neutral-800)]">
                            This is a short internal code used to identify the item — it fills in
                            by itself from the selected attribute values, with the product&apos;s code added in front.
                            You only need to change it if you want a shorter or different code.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowInfo(false)}
                          className="text-neutral-400 hover:text-neutral-700 font-bold text-sm leading-none ml-1 p-0.5 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`flex items-stretch rounded-lg border transition-all ${
                  extraSlugError || methods.formState.errors.slug
                    ? "border-red-500 ring-2 ring-red-500/10"
                    : "border-neutral-200 focus-within:border-secondary-600 focus-within:ring-2 focus-within:ring-secondary-600/20"
                } bg-white overflow-hidden`}
              >
                <div
                  className="flex items-center px-3 bg-neutral-100/90 border-r border-neutral-200 text-neutral-600 font-mono text-xs select-none max-w-[60%] shrink-0 truncate"
                  title={
                    slugPrefix
                      ? `Product Prefix: ${slugPrefix}`
                      : "Select Product to auto-generate prefix"
                  }
                >
                  {slugPrefix ? (
                    <span className="font-semibold text-neutral-800 tracking-wide truncate">
                      {slugPrefix}
                    </span>
                  ) : (
                    <span className="text-neutral-400 italic text-[11px]">
                      [category_product_code]_
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  value={extraSlug}
                  onChange={(e) => handleExtraSlugChange(e.target.value)}
                  placeholder="e.g. CLASSIC_MIX"
                  className="flex-1 min-w-0 px-3 py-2 text-sm text-neutral-900 bg-transparent outline-none font-mono placeholder:text-neutral-400 placeholder:font-sans uppercase"
                />
              </div>

              <div className="mt-1.5 min-h-[18px]">
                {extraSlugError || methods.formState.errors.slug?.message ? (
                  <p className="text-xs text-red-500 font-medium">
                    {extraSlugError || methods.formState.errors.slug?.message}
                  </p>
                ) : (
                  <p className="text-[11px] text-neutral-500 font-mono flex items-center gap-1 flex-wrap">
                    <span className="font-sans font-medium text-neutral-600">Full Code:</span>
                    {slugPrefix || extraSlug ? (
                      <span className="text-secondary-700 font-semibold bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                        {slugPrefix}
                        <span className={extraSlug ? "text-secondary-800 font-bold" : "text-neutral-400 italic font-normal"}>
                          {extraSlug || "ENTER_ITEM_CODE"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-neutral-400 italic font-sans">
                        Select product to generate prefix
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Featured & Active */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <FormCheckbox
                name="isFeatured"
                label="Featured Item"
                description="Display this item prominently in featured sections"
              />
              <FormCheckbox
                name="isActive"
                label="Active"
                description="Inactive items are hidden from customers"
              />
            </div>
          </div>
        </details>

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

export { VariantForm };
