"use client";

import * as React from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormInput } from "@/components/forms/form-input";
import { FormMultiSelect } from "@/components/forms/form-multi-select";
import { FormSelect } from "@/components/forms/form-select";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { useCategories } from "@/features/categories/hooks";
import type { HeaderMenuGender } from "../validations/admin-header-menu.schema";

const GENDER_OPTIONS = [
  { value: "unisex", label: "Unisex / Everyone" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "kids", label: "Kids" },
];

const headerMenuFormSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(150),
    categoryIds: z.array(z.string()).default([]),
    link: z.string().trim().max(500).optional().nullable(),
    gender: z.enum(["men", "women", "kids", "unisex"]).optional().nullable(),
    sortOrder: z.union([z.number(), z.literal("")]).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const hasCategories = data.categoryIds.length > 0;
    const hasLink = Boolean(data.link?.trim());
    if (!hasCategories && !hasLink) {
      ctx.addIssue({
        code: "custom",
        path: ["link"],
        message: "Select a category or provide a link",
      });
    }
    if (hasCategories && hasLink) {
      ctx.addIssue({
        code: "custom",
        path: ["link"],
        message: "Choose either categories or a link, not both",
      });
    }
  });

type HeaderMenuFormData = z.infer<typeof headerMenuFormSchema>;

export interface HeaderMenuFormPayload {
  label: string;
  categoryIds: string[];
  link: string | null;
  gender: HeaderMenuGender | null;
  sortOrder: number;
  isActive: boolean;
}

interface HeaderMenuFormProps {
  initialData?: {
    label?: string;
    categoryIds?: string[];
    categories?: { id: string; name: string }[];
    link?: string | null;
    gender?: HeaderMenuGender | null;
    sortOrder?: number;
    isActive?: boolean;
  };
  onSubmit: (data: HeaderMenuFormPayload) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function HeaderMenuForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Menu Item",
}: HeaderMenuFormProps) {
  const { data: categoriesData } = useCategories({ pageSize: 500 });
  const categoryOptions = React.useMemo(() => {
    const fromList = (categoriesData?.data ?? []).map((c) => ({
      value: String(c.id),
      label: c.name,
    }));
    // Categories already linked to this item (e.g. later deactivated/soft-deleted)
    // may have dropped out of the active category list — keep them selectable so
    // the picker still reflects what's actually saved on the item.
    const seen = new Set(fromList.map((o) => o.value));
    const fromInitial = (initialData?.categories ?? [])
      .filter((c) => !seen.has(c.id))
      .map((c) => ({ value: c.id, label: c.name }));
    return [...fromList, ...fromInitial];
  }, [categoriesData, initialData?.categories]);

  const methods = useForm<HeaderMenuFormData>({
    resolver: zodResolver(headerMenuFormSchema) as any,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      label: initialData?.label ?? "",
      categoryIds: initialData?.categoryIds ?? [],
      link: initialData?.link ?? "",
      gender: (initialData?.gender ?? "") as HeaderMenuFormData["gender"],
      sortOrder: initialData?.sortOrder ?? 0,
      isActive: initialData?.isActive ?? true,
    },
  });

  const { control, setValue, getValues } = methods;
  const categoryIds = useWatch({ control, name: "categoryIds" });
  const link = useWatch({ control, name: "link" });
  const isActive = useWatch({ control, name: "isActive" });

  const hasCategories = categoryIds.length > 0;
  const hasLink = Boolean(link?.trim());

  // Drop any pre-selected category id that isn't a real category at all. Categories
  // still linked to this item are kept selectable via the initialData fallback above,
  // even if they've since been deactivated or soft-deleted.
  React.useEffect(() => {
    if (!categoriesData) return;
    const validValues = new Set(categoryOptions.map((o) => o.value));
    const current = getValues("categoryIds");
    const pruned = current.filter((id) => validValues.has(id));
    if (pruned.length !== current.length) {
      setValue("categoryIds", pruned, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesData]);

  const handleSubmit = async (values: HeaderMenuFormData) => {
    await onSubmit({
      label: values.label.trim(),
      categoryIds: values.categoryIds,
      link: values.link?.trim() || null,
      gender: values.gender || null,
      sortOrder: values.sortOrder === "" ? 0 : Number(values.sortOrder),
      isActive: values.isActive,
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} className="space-y-6">
        <FormInput name="label" label="Label" placeholder="e.g. Women, GenZ Store" required />

        <FormMultiSelect
          name="categoryIds"
          label="Categories"
          options={categoryOptions}
          searchPlaceholder="Search categories..."
          disabled={hasLink}
          description={
            hasLink
              ? "Clear the link below to link to a category instead."
              : "Pick one for a normal category link, or several to group them under one dropdown."
          }
        />

        <FormInput
          name="link"
          label="Link"
          placeholder="e.g. /products?sortBy=discount"
          required={!hasCategories}
          disabled={hasCategories}
          description={
            hasCategories
              ? "Remove the selected categories above to use a custom link instead."
              : "Required when no category is selected."
          }
        />

        <FormSelect
          name="gender"
          label="Gender / Audience"
          placeholder="No audience filter (shows all genders)"
          options={GENDER_OPTIONS}
          description="When set, every link this nav item resolves to (including its categories) only shows products for this audience, even if a category is shared with another nav item."
        />

        <FormInput
          name="sortOrder"
          label="Sort Order"
          type="number"
          min="0"
          step="1"
          placeholder="0"
        />

        <div className="flex items-center justify-between gap-4 rounded-xl border border-theme-border bg-theme-surface-alt p-4">
          <div>
            <p className="text-sm font-semibold text-theme-text-primary">Status</p>
            <p className="text-xs text-theme-text-muted">
              {isActive ? "Active - visible on the storefront." : "Inactive - hidden from the storefront."}
            </p>
          </div>
          <FormSwitch
            checked={Boolean(isActive)}
            onCheckedChange={(checked) => setValue("isActive", checked, { shouldDirty: true })}
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

export default HeaderMenuForm;
