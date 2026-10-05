"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAdminHsnCodeSchema,
  type CreateAdminHsnCodeInput,
} from "@/features/hsn-codes/validations/admin-hsn-code.schema";
import { FormInput } from "@/components/forms/form-input";
import { FormTextarea } from "@/components/forms/form-textarea";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { FormSelect } from "@/components/forms/form-select";
import { useGstRates } from "@/features/gst-rates/hooks/use-gst-rates";

interface HsnCodeFormProps {
  initialData?: Partial<CreateAdminHsnCodeInput>;
  isEditing?: boolean;
  onSubmit: (data: CreateAdminHsnCodeInput) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function HsnCodeForm({
  initialData,
  isEditing = false,
  onSubmit,
  isLoading = false,
  submitLabel = "Save HSN Code",
}: HsnCodeFormProps) {
  const methods = useForm<CreateAdminHsnCodeInput>({
    resolver: zodResolver(createAdminHsnCodeSchema),
    defaultValues: {
      code: initialData?.code ?? "",
      description: initialData?.description ?? "",
      gstRateId: initialData?.gstRateId ?? "",
    },
  });

  const { data: gstData } = useGstRates({ pageSize: 100 });

  const gstOptions =
    gstData?.data.map((gst) => ({
      label: `${gst.name} (${gst.igstPercent}%)`,
      value: gst.id,
    })) ?? [];

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(async (data) => {
          await onSubmit(data);
        })}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            name="code"
            label="HSN Code"
            placeholder="Enter HSN code"
            required
          />

          <FormSelect
            name="gstRateId"
            label="GST Rate"
            placeholder="Select GST rate"
            options={gstOptions}
            required
          />
        </div>

        <FormTextarea
          name="description"
          label="Description"
          placeholder="Enter HSN description"
        />

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