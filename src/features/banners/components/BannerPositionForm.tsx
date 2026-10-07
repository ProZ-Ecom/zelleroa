"use client";

import React, { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormInput } from "@/components/forms/form-input";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { BannerPositionDto } from "../types";

const bannerPositionFormSchema = z.object({
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters"),
  slug: z
    .string({ message: "Slug is required" })
    .trim()
    .min(1, "Slug is required")
    .max(120, "Slug cannot exceed 120 characters")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and hyphens only (e.g. home-hero)"
    ),
  page: z.string().trim().max(100).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type BannerPositionFormData = z.infer<typeof bannerPositionFormSchema>;

interface BannerPositionFormProps {
  initialData?: Partial<BannerPositionDto> | null;
  onSubmit: (data: BannerPositionFormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function BannerPositionForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Position",
}: BannerPositionFormProps) {
  const getFormDefaults = React.useCallback(
    () => ({
      name: initialData?.name || "",
      slug: initialData?.slug || "",
      page: initialData?.page || "",
      isActive: initialData?.isActive ?? true,
    }),
    [initialData]
  );

  const methods = useForm<BannerPositionFormData>({
    resolver: zodResolver(bannerPositionFormSchema) as any,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: getFormDefaults(),
  });

  useEffect(() => {
    methods.reset(getFormDefaults());
  }, [getFormDefaults, methods]);

  const handleFormSubmit = async (values: BannerPositionFormData) => {
    await onSubmit({
      ...values,
      page: values.page && values.page.trim() ? values.page.trim() : null,
    });
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(handleFormSubmit)}
        className="space-y-5"
      >
        <FormInput
          name="name"
          label="Position Name"
          placeholder="e.g. Home Hero Banner"
          required
        />

        <FormInput
          name="slug"
          label="Slug"
          description="Unique key used by the storefront to fetch banners for this position (e.g. home-hero, home-offer, home-popup-offer)."
          placeholder="e.g. home-hero"
          isSlug={false}
          required
        />

        <FormInput
          name="page"
          label="Page (Optional)"
          placeholder="e.g. home"
        />

        <div className="flex items-center justify-between rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-neutral-900)]">
              Active Status
            </p>
            <p className="text-xs text-[var(--color-neutral-500)]">
              Inactive positions are hidden from the storefront and the banner form.
            </p>
          </div>
          <FormSwitch
            checked={methods.watch("isActive")}
            onCheckedChange={(val) => methods.setValue("isActive", val)}
          />
        </div>

        <div className="flex justify-end pt-2">
          <FormSubmitButton
            isLoading={isLoading}
            className="h-11 rounded-xl bg-[var(--color-primary-500)] px-6 text-sm font-semibold text-white hover:bg-[var(--color-primary-600)] cursor-pointer"
          >
            {submitLabel}
          </FormSubmitButton>
        </div>
      </form>
    </FormProvider>
  );
}
