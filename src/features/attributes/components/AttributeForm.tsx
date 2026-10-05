"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormCheckbox } from "@/components/forms/form-checkbox";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { ColorImagePicker } from "./ColorImagePicker";

const attributeFormSchema = z.object({
  name: z
    .string({ message: "Attribute name is required" })
    .trim()
    .min(1, "Attribute name cannot be empty")
    .max(100, "Attribute name cannot exceed 100 characters"),
  slug: z
    .string({ message: "Attribute code is required" })
    .trim()
    .min(1, "Attribute code cannot be empty")
    .max(120, "Attribute code cannot exceed 120 characters")
    .regex(/^[A-Za-z0-9_]+$/, "Use letters, numbers, and underscores only"),
  type: z.enum(["text", "color"]),
  multipleSelection: z.boolean(),
});

export type AttributeFormValues = z.infer<typeof attributeFormSchema>;

export interface AttributeFormPendingValue {
  value: string;
  colorHex?: string;
  imageUrl?: string;
}

interface AttributeFormProps {
  initialData?: Partial<AttributeFormValues>;
  isEditing?: boolean;
  showInitialValues?: boolean;
  onSubmit: (
    data: AttributeFormValues & { values?: AttributeFormPendingValue[] }
  ) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

function AttributeForm({
  initialData,
  showInitialValues = false,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Attribute",
}: AttributeFormProps) {
  const [pendingValues, setPendingValues] = useState<AttributeFormPendingValue[]>([]);
  const [valueDraft, setValueDraft] = useState("");
  const [colorDraft, setColorDraft] = useState("#000000");
  const [imageDraft, setImageDraft] = useState("");
  const [valuesError, setValuesError] = useState<string | null>(null);

  const methods = useForm<AttributeFormValues>({
    resolver: zodResolver(attributeFormSchema),
    mode: "onChange",
    defaultValues: {
      name: initialData?.name || "",
      slug: initialData?.slug || "",
      type: initialData?.type || "text",
      multipleSelection: initialData?.multipleSelection ?? true,
    },
  });

  const watchedType = methods.watch("type");
  const isColor = watchedType === "color";

  const handleAddValue = () => {
    const v = valueDraft.trim();
    if (!v) return;
    if (pendingValues.some((existing) => existing.value.toLowerCase() === v.toLowerCase())) {
      setValueDraft("");
      return;
    }
    setPendingValues((prev) => [
      ...prev,
      {
        value: v,
        ...(isColor ? { colorHex: colorDraft } : {}),
        ...(isColor && imageDraft ? { imageUrl: imageDraft } : {}),
      },
    ]);
    setValueDraft("");
    setImageDraft("");
    setValuesError(null);
  };

  const handleFormSubmit = (data: AttributeFormValues) => {
    if (showInitialValues && pendingValues.length === 0) {
      setValuesError("Add at least one value");
      return;
    }
    return onSubmit({ ...data, values: showInitialValues ? pendingValues : undefined });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleFormSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            name="name"
            label="Attribute Name"
            placeholder="e.g. Fabric, Dial Color, Bag Type"
            required
          />

          <FormInput
            name="slug"
            label="Attribute Code"
            placeholder="e.g. FABRIC"
            infoMessage="Use letters, numbers, and underscores only."
            required
          />

          <FormSelect
            name="type"
            label="Attribute Type"
            required
            options={[
              { value: "text", label: "Text (e.g. Fabric, Pattern)" },
              { value: "color", label: "Color (stores a hex code per value)" },
            ]}
            description="Color-type attributes let each value store a swatch/hex code once, instead of retyping it on every product."
          />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
          <FormCheckbox
            name="multipleSelection"
            label="Multiple Selection"
            description="When ON, an item can pick several of this attribute's values at once (e.g. Color -> Red, Blue and Green). When OFF, only one value can be selected per item (e.g. Fit -> Regular, Slim or Oversized)."
          />
        </div>

        {showInitialValues && (
          <div>
            <label className="block text-xs font-semibold text-[var(--color-neutral-800)] mb-1.5">
              Values <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={valueDraft}
                onChange={(e) => setValueDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddValue();
                  }
                }}
                placeholder={isColor ? "e.g. Navy Blue" : "e.g. Cotton"}
                className="flex-1 min-w-0 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-secondary-600 focus:ring-2 focus:ring-secondary-600/20"
              />
              {isColor && (
                <>
                  <input
                    type="color"
                    value={colorDraft}
                    onChange={(e) => setColorDraft(e.target.value)}
                    title="Color swatch"
                    className="h-[38px] w-10 shrink-0 cursor-pointer rounded-lg border border-neutral-200 p-1"
                  />
                  <ColorImagePicker imageUrl={imageDraft} onChange={setImageDraft} />
                </>
              )}
              <button
                type="button"
                onClick={handleAddValue}
                className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>

            {valuesError && (
              <p className="mt-1.5 text-xs font-medium text-red-500">{valuesError}</p>
            )}

            {pendingValues.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pendingValues.map((v) => (
                  <span
                    key={v.value}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary-50 px-2.5 py-1 text-xs font-medium text-secondary-700"
                  >
                    {v.imageUrl ? (
                      <img
                        src={v.imageUrl}
                        alt=""
                        className="h-4 w-4 rounded-full border border-white object-cover"
                      />
                    ) : (
                      v.colorHex && (
                        <span
                          className="h-3 w-3 rounded-full border border-white"
                          style={{ backgroundColor: v.colorHex }}
                        />
                      )
                    )}
                    {v.value}
                    <button
                      type="button"
                      onClick={() =>
                        setPendingValues((prev) => prev.filter((x) => x.value !== v.value))
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
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

export { AttributeForm };
