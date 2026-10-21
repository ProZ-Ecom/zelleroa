"use client";

import * as React from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormInput } from "@/components/forms/form-input";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormSubmitButton } from "@/components/forms/form-submit-button";

const tagFormSchema = z.object({
  name: z.string().trim().min(1, "Tag name is required").max(100),
  isActive: z.boolean(),
});

type TagFormData = z.infer<typeof tagFormSchema>;

interface TagFormProps {
  initialData?: { name?: string; isActive?: boolean };
  onSubmit: (data: TagFormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function TagForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Tag",
}: TagFormProps) {
  const methods = useForm<TagFormData>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      isActive: initialData?.isActive ?? true,
    },
  });
  const isActive = useWatch({ control: methods.control, name: "isActive" });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <FormInput
          name="name"
          label="Tag Name"
          placeholder="e.g. Summer Sale, New Arrivals"
          description="Shown to admins when picking a tag for a header menu item."
          required
        />

        <div className="flex items-center justify-between gap-4 rounded-xl border border-theme-border bg-theme-surface-alt p-4">
          <div>
            <p className="text-sm font-semibold text-theme-text-primary">Status</p>
            <p className="text-xs text-theme-text-muted">
              {isActive ? "Active - can be used in the header menu." : "Inactive - hidden from the storefront."}
            </p>
          </div>
          <FormSwitch
            checked={Boolean(isActive)}
            onCheckedChange={(checked) =>
              methods.setValue("isActive", checked, { shouldDirty: true })
            }
          />
        </div>

        <div className="flex justify-end pt-4">
          <FormSubmitButton
            isLoading={isLoading}
            className="h-11 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-6 text-sm font-semibold text-white transition-colors"
          >
            {submitLabel}
          </FormSubmitButton>
        </div>
      </form>
    </FormProvider>
  );
}
