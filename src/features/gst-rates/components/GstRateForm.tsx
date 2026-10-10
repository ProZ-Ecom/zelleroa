"use client";

import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAdminGstRateSchema } from "../validations/admin-gst-rate.schema";
import { FormInput } from "@/components/forms/form-input";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { z } from "zod";

type GstRateFormData = z.infer<typeof createAdminGstRateSchema>;

const PRESETS = [0, 5, 12, 18, 28];

const autoName = (total: number) =>
  total === 0 ? "GST 0 Percent Exempt" : `GST ${total} Percent Standard`;

interface GstRateFormProps {
  initialData?: Partial<GstRateFormData>;
  isEditing?: boolean;
  onSubmit: (data: GstRateFormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function GstRateForm({
  initialData,
  isEditing = false,
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

  const [nameManual, setNameManual] = useState(isEditing);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const round = (n: number) => Math.round(n * 100) / 100;

  // Keep IGST = CGST + SGST and the name in sync until the user edits them.
  useEffect(() => {
    const sub = methods.watch((values, { name, type }) => {
      if (type !== "change") return;
      if (name === "cgstPercent" || name === "sgstPercent") {
        setActivePreset(null);
        const total = round(
          (Number(values.cgstPercent) || 0) + (Number(values.sgstPercent) || 0),
        );
        methods.setValue("igstPercent", total, { shouldValidate: true });
        if (!nameManual) methods.setValue("name", autoName(total), { shouldValidate: true });
      }
      if (name === "igstPercent") {
        // IGST is the total; split it equally into CGST and SGST.
        const total = Number(values.igstPercent) || 0;
        const half = round(total / 2);
        methods.setValue("cgstPercent", half, { shouldValidate: true });
        methods.setValue("sgstPercent", half, { shouldValidate: true });
        if (!nameManual) methods.setValue("name", autoName(total), { shouldValidate: true });
        setActivePreset(null);
      }
      if (name === "name") setNameManual(!!values.name?.trim());
    });
    return () => sub.unsubscribe();
  }, [methods, nameManual]);

  const applyPreset = (total: number) => {
    const half = round(total / 2);
    methods.setValue("cgstPercent", half, { shouldValidate: true });
    methods.setValue("sgstPercent", half, { shouldValidate: true });
    methods.setValue("igstPercent", total, { shouldValidate: true });
    if (!nameManual) methods.setValue("name", autoName(total), { shouldValidate: true });
    setActivePreset(total);
  };

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
        className="space-y-5"
      >
        <FormInput
          name="name"
          label="GST Rate Name"
          placeholder="GST 18 Percent Standard"
          description="Auto-filled from the rate. You can rename it."
          required
        />

        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-neutral-700)]">
            Choose a GST slab
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={`h-9 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  activePreset === p
                    ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)] text-white"
                    : "border-[var(--color-neutral-200)] bg-white text-[var(--color-neutral-700)] hover:border-[var(--color-primary-500)] hover:text-[var(--color-primary-600)]"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4 sm:p-5">
          <FormInput
            name="igstPercent"
            label="Total GST (IGST) %"
            type="number"
            min="0"
            max="100"
            step="any"
            placeholder="18"
            description="Splits equally into CGST and SGST."
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            required
          />

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
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
          </div>
        </div>

        <div className="flex justify-end pt-2">
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