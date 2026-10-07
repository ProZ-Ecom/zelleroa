"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAdminGstRateSchema } from "../validations/admin-gst-rate.schema";
import { FormInput } from "@/components/forms/form-input";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { z } from "zod";

type GstRateFormData = z.infer<typeof createAdminGstRateSchema>;

interface GstRateFormProps {
  initialData?: Partial<GstRateFormData>;
  isEditing?: boolean;
  onSubmit: (data: GstRateFormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function GstRateForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = "Save GST Rate",
}: GstRateFormProps) {
  const methods = useForm<GstRateFormData>({
    resolver: zodResolver(createAdminGstRateSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: initialData?.name || "",
      cgstPercent: initialData?.cgstPercent ?? 0,
      sgstPercent: initialData?.sgstPercent ?? 0,
      igstPercent: initialData?.igstPercent ?? 0,
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent minus sign and exponential notation
    if (e.key === "-" || e.key === "Minus" || e.key === "e" || e.key === "E" || e.key === "+") {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasteData = e.clipboardData.getData("text");
    if (pasteData.includes("-")) {
      e.preventDefault();
    }
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(async (data) => {
          await onSubmit(data);
        })}
        className="space-y-6"
      >
        <FormInput
          name="name"
          label="GST Rate Name"
          placeholder="GST 18 Percent Standard"
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormInput
            name="cgstPercent"
            label="CGST %"
            type="number"
            min="0"
            max="100"
            step="any"
            placeholder="9"
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            required
          />

          <FormInput
            name="sgstPercent"
            label="SGST %"
            type="number"
            min="0"
            max="100"
            step="any"
            placeholder="9"
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            required
          />

          <FormInput
            name="igstPercent"
            label="IGST %"
            type="number"
            min="0"
            max="100"
            step="any"
            placeholder="18"
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            required
          />
        </div>

        <div className="flex justify-end pt-4">
          <FormSubmitButton
            isLoading={isLoading}
            className="h-11 rounded-xl bg-[var(--color-primary-500)] px-6 text-sm font-semibold text-white hover:bg-[var(--color-primary-600)]"
          >
            {submitLabel}
          </FormSubmitButton>
        </div>
      </form>
    </FormProvider>
  );
}