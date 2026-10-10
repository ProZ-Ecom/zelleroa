"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrandSchema } from "../validations/brand.schema";
import { FormInput } from "@/components/forms/form-input";
import { FormTextarea } from "@/components/forms/form-textarea";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { z } from "zod";

type BrandFormData = z.infer<typeof createBrandSchema>;

interface BrandFormProps {
  initialData?: Partial<BrandFormData> | Record<string, unknown>;
  isEditing?: boolean;
  onSubmit: (data: BrandFormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

function BrandForm({
  initialData,
  isEditing = false,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Brand",
}: BrandFormProps) {
  const methods = useForm<BrandFormData>({
    resolver: zodResolver(createBrandSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: (initialData?.name as string) || "",
      slug: (initialData?.slug as string) || "",
      description: (initialData?.description as string) || "",
    },
  });

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit((data) => onSubmit(data))} 
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            name="name"
            label="Brand Name"
            placeholder="Enter brand name"
            required
          />

          <FormInput
            name="slug"
            label="Brand Code"
            placeholder="e.g. ZELLEROA_COUTURE"
            infoMessage="Enter brand code (e.g. ZELLEROA_COUTURE). Special characters are allowed."
            required
          />
        </div>

        <FormTextarea
          name="description"
          label="Description"
          placeholder="Enter brand description"
        />

        {/* <FormImageUpload
          name="logo"
          label="Brand Logo"
          folder = "brands"
        /> */}

        {/* <FormCheckbox
          name="isActive"
          label="Active"
          description="Brand is visible and available for use"
        /> */}

        <div className="flex justify-end pt-4">
          <FormSubmitButton
            isLoading={isLoading}
            className="h-11 rounded-xl bg-gradient-to-b from-[var(--color-primary-400)] to-[var(--color-primary-600)] shadow-[0_6px_16px_-6px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all px-6 text-sm font-semibold text-white hover:-translate-y-px hover:shadow-[0_10px_20px_-8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0"
          >
            {submitLabel}
          </FormSubmitButton>
        </div>
      </form>
    </FormProvider>
  );
}

export { BrandForm };