"use client";

import * as React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCategorySchema } from "../validations/category.schema";
import { FormInput, formatSlug } from "@/components/forms/form-input";
import { FormTextarea } from "@/components/forms/form-textarea";
import { FormImageUpload } from "@/components/forms/form-image-upload";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { z } from "zod";

type CategoryFormData = z.infer<typeof createCategorySchema>;

interface CategoryFormProps {
  initialData?: Record<string, unknown>;
  isEditing?: boolean;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

function CategoryForm({
  initialData,
  isEditing = false,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Category",
}: CategoryFormProps) {
  const methods = useForm<CategoryFormData>({
    resolver: zodResolver(createCategorySchema) as any,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: (initialData?.name as string) || "",
      slug: (initialData?.slug as string) || "",
      description: (initialData?.description as string) || "",
      image: (initialData?.image as string) || "",
      parentId: (initialData?.parentId as string) || "",
      isActive: (initialData?.isActive as boolean) ?? true,
      sortOrder: (initialData?.sortOrder as number) || 0,
      metaTitle: (initialData?.metaTitle as string) || "",
      metaDescription: (initialData?.metaDescription as string) || "",
    },
  });

  const [codeTouched, setCodeTouched] = React.useState<boolean>(() =>
    Boolean(initialData?.slug)
  );
  const watchedName = methods.watch("name");

  // Fill in the code from the Category Name automatically, same convention as
  // ItemEntityForm's code field - stops as soon as the admin edits it by hand.
  React.useEffect(() => {
    if (codeTouched) return;
    methods.setValue("slug", formatSlug(watchedName || ""), {
      shouldValidate: methods.formState.isSubmitted,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName, codeTouched]);

  return (
    <FormProvider {...methods}>
      <form
          onSubmit={methods.handleSubmit((data) => {
            console.log("Category Form Data:", data);
            onSubmit(data as CategoryFormData);
          })}
          className="space-y-6"
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            name="name"
            label="Category Name"
            placeholder="Enter category name"
            required
          />

          <FormInput
            name="slug"
            label="Category Code (fills in automatically)"
            placeholder="e.g. SWEETS_SNACKS"
            infoMessage="Use letters, numbers, and underscores only (e.g. SWEETS_SNACKS). No spaces or other special characters allowed."
            onFocus={() => setCodeTouched(true)}
            required
          />
        </div>

        <FormTextarea
          name="description"
          label="Description"
          placeholder="Enter category description"
        />

        <FormImageUpload
          name="image"
          label="Category Image"
          folder="categories"
          infoMessage="Upload a JPG, PNG, or WebP image up to 5MB. Recommended size: 500 × 500 px."
          required
        />

        {/* <FormCheckbox
          name="isActive"
          label="Active"
          description="Category is visible and available for use"
        /> */}

        {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            name="metaTitle"
            label="Meta Title"
            placeholder="SEO meta title"
          />

          <FormInput
            name="metaDescription"
            label="Meta Description"
            placeholder="SEO meta description"
          />
        </div> */}

        <FormInput
            name="sortOrder"
            label="Sort Order"
            type="number"
            min="0"
            max="100"
            step="1"
            placeholder="0"
        />

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

export { CategoryForm };
