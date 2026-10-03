"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info } from "lucide-react";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormSubmitButton } from "@/components/forms/form-submit-button";

const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Product name is required")
    .max(200, "Product name cannot exceed 200 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Product code is required")
    .max(220, "Product code cannot exceed 220 characters"),
  categoryId: z
    .string()
    .min(1, "Please select a category"),
  brandId: z
    .string()
    .optional(),
  hsnCodeId: z
    .string()
    .min(1, "Please select an HSN code"),
  gender: z.enum(["men", "women", "kids", "unisex"], {
    message: "Please select a gender / audience",
  }),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

const GENDER_OPTIONS = [
  { value: "unisex", label: "Unisex" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "kids", label: "Kids" },
];

export interface ProductOption {
  value: string;
  label: string;
  slug?: string;
}

interface ProductFormProps {
  initialData?: Partial<ProductFormValues>;
  isEditing?: boolean;
  categories: ProductOption[];
  brands?: ProductOption[];
  hsnCodes: ProductOption[];
  onSubmit: (data: ProductFormValues) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

function ProductForm({
  initialData,
  isEditing = false,
  categories = [],
  brands = [],
  hsnCodes = [],
  onSubmit,
  isLoading = false,
  submitLabel = "Save Product",
}: ProductFormProps) {
  const defaultBrandId =
    initialData?.brandId || (brands && brands.length > 0 ? brands[0].value : "");

  // Helper to compute prefix from category code/slug
  const computePrefix = (catVal?: string): string => {
    const c = categories.find((item) => item.value === catVal);
    const cSlug = c?.slug?.trim() || "";

    if (cSlug) {
      return `${cSlug.toUpperCase()}_`;
    }
    return "";
  };

  const initialCatId = initialData?.categoryId || "";
  const initialPrefix = computePrefix(initialCatId);

  const extractInitialExtraSlug = (fullSlug?: string, prefix?: string): string => {
    if (!fullSlug) return "";
    if (prefix && fullSlug.startsWith(prefix)) {
      return fullSlug.slice(prefix.length);
    }
    // Clean and return uppercase with underscores
    return fullSlug.replace(/[-\s]+/g, "_").replace(/[^A-Za-z0-9_]/g, "").toUpperCase();
  };

  const [extraSlug, setExtraSlug] = useState<string>(() =>
    extractInitialExtraSlug(initialData?.slug, initialPrefix)
  );
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

  const methods = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: initialData?.name || "",
      slug: initialData?.slug || "",
      categoryId: initialData?.categoryId || "",
      brandId: defaultBrandId,
      hsnCodeId: initialData?.hsnCodeId || "",
      gender: initialData?.gender || ("" as ProductFormValues["gender"]),
    },
  });

  const selectedCategoryId = methods.watch("categoryId");

  // Dynamic non-editable prefix based on currently selected Category
  const slugPrefix = useMemo(
    () => computePrefix(selectedCategoryId),
    [selectedCategoryId, categories]
  );

  // Sync combined product code into form state whenever prefix or extraSlug updates
  useEffect(() => {
    const fullSlug = `${slugPrefix}${extraSlug}`.trim();
    methods.setValue("slug", fullSlug, {
      shouldValidate: methods.formState.isSubmitted,
    });
  }, [slugPrefix, extraSlug, methods]);

  // Ensure default brandId is populated
  useEffect(() => {
    if (!methods.getValues("brandId") && defaultBrandId) {
      methods.setValue("brandId", defaultBrandId);
    }
  }, [defaultBrandId, methods]);

  const handleExtraSlugChange = (raw: string) => {
    // Format product code: uppercase, convert spaces to underscore, keep special characters
    const formatted = raw
      .toUpperCase()
      .replace(/\s+/g, "_");
    setExtraSlug(formatted);
    if (extraSlugError) setExtraSlugError(null);
    methods.clearErrors("slug");
  };

  const handleFormSubmit = async (formData: ProductFormValues) => {
    // 1. Ensure brandId is set to default if empty
    const finalBrandId = formData.brandId || defaultBrandId;

    // 2. Validate category selection
    if (!formData.categoryId) {
      methods.setError("categoryId", { message: "Please select a category" });
      return;
    }

    // 3. Admin must enter product code
    if (!extraSlug.trim()) {
      const msg = "Please enter the product code (cannot be empty)";
      setExtraSlugError(msg);
      methods.setError("slug", {
        type: "manual",
        message: msg,
      });
      return;
    }

    const finalSlug = `${slugPrefix}${extraSlug.trim()}`;
    await onSubmit({
      ...formData,
      brandId: finalBrandId,
      slug: finalSlug,
    });
  };

  const categoryOptions = categories;
  const hsnCodeOptions = hsnCodes;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(handleFormSubmit)}
        className="space-y-6"
      >
        {/* Row 1: Product Name & Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            name="name"
            label="Product Name"
            placeholder="e.g. Banana Chips"
            required
          />

          <FormSelect
            name="categoryId"
            label="Category"
            placeholder="Select category"
            options={categoryOptions}
            required
          />
        </div>

        {/* Row 2: Product Code (full width) */}
        <div className="pt-0 mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="block text-xs font-semibold text-[var(--color-neutral-800)]">
              Product Code <span className="text-red-500">*</span>
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
                        Enter product code (special characters allowed, e.g. BANANA_CHIPS). Category code prefix is automatically applied.
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
            {/* Non-editable Category Code prefix */}
            <div
              className="flex items-center px-3 bg-neutral-100/90 border-r border-neutral-200 text-neutral-600 font-mono text-xs select-none max-w-[60%] shrink-0 truncate"
              title={
                slugPrefix
                  ? `Category Prefix: ${slugPrefix}`
                  : "Select Category to auto-generate prefix"
              }
            >
              {slugPrefix ? (
                <span className="font-semibold text-neutral-800 tracking-wide truncate">
                  {slugPrefix}
                </span>
              ) : (
                <span className="text-neutral-400 italic text-[11px]">
                  [category_code]_
                </span>
              )}
            </div>

            {/* Editable extra code for the product */}
            <input
              type="text"
              value={extraSlug}
              onChange={(e) => handleExtraSlugChange(e.target.value)}
              placeholder="e.g. BANANA_CHIPS"
              className="flex-1 min-w-0 px-3 py-2 text-sm text-neutral-900 bg-transparent outline-none font-mono placeholder:text-neutral-400 placeholder:font-sans uppercase"
            />
          </div>

          {/* Helper message / live preview / error */}
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
                      {extraSlug || "ENTER_PRODUCT_CODE"}
                    </span>
                  </span>
                ) : (
                  <span className="text-neutral-400 italic font-sans">
                    Select category to generate prefix
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Row 3: HSN Code & Gender/Audience */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormSelect
            name="hsnCodeId"
            label="HSN Code"
            placeholder="Select HSN code"
            options={hsnCodeOptions}
            required
          />

          <FormSelect
            name="gender"
            label="Gender / Audience"
            placeholder="Select audience"
            options={GENDER_OPTIONS}
            required
          />

        </div>

        <div className="flex justify-end pt-4">
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

export { ProductForm };
