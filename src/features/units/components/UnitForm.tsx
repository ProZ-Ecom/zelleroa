"use client";

import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAdminUnitSchema,
  type UnitType,
} from "../validations/admin-unit.schema";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { ChevronDown, Sparkles } from "lucide-react";

type UnitFormData = {
  name: string;
  code: string;
  type: UnitType;
  baseUnitId?: string | null;
  conversionFactor?: number;
  sortOrder?: number;
};

const APPAREL_PRESETS = [
  { name: "Piece", code: "PC", type: "count" as UnitType },
  { name: "Small", code: "S", type: "size" as UnitType },
  { name: "Medium", code: "M", type: "size" as UnitType },
  { name: "Large", code: "L", type: "size" as UnitType },
  { name: "XL", code: "XL", type: "size" as UnitType },
  { name: "XXL", code: "XXL", type: "size" as UnitType },
  { name: "Waist 28", code: "28", type: "size" as UnitType },
  { name: "Waist 30", code: "30", type: "size" as UnitType },
  { name: "Waist 32", code: "32", type: "size" as UnitType },
  { name: "Waist 34", code: "34", type: "size" as UnitType },
  { name: "Waist 36", code: "36", type: "size" as UnitType },
];

interface UnitFormProps {
  initialData?: Partial<UnitFormData>;
  baseUnits?: Array<{
    id: string;
    name: string;
    code: string;
    type: UnitType;
  }>;
  isEditing?: boolean;
  onSubmit: (data: UnitFormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function UnitForm({
  initialData,
  baseUnits = [],
  onSubmit,
  isLoading = false,
  submitLabel = "Save Unit",
}: UnitFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      initialData?.baseUnitId ||
      (initialData?.conversionFactor && initialData.conversionFactor !== 1)
    )
  );

  const methods = useForm<UnitFormData>({
    resolver: zodResolver(createAdminUnitSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: initialData?.name || "",
      code: initialData?.code || "",
      type: initialData?.type || "count",
      baseUnitId: initialData?.baseUnitId || "",
      conversionFactor: initialData?.conversionFactor ?? 1,
      sortOrder: initialData?.sortOrder ?? 0,
    },
  });

  const selectedType = useWatch({
    control: methods.control,
    name: "type",
  });

  const filteredBaseUnits = baseUnits.filter(
    (unit) => unit.type?.toLowerCase() === selectedType?.toLowerCase()
  );

  const applyPreset = (preset: (typeof APPAREL_PRESETS)[number]) => {
    methods.setValue("name", preset.name, { shouldValidate: true, shouldDirty: true });
    methods.setValue("code", preset.code, { shouldValidate: true, shouldDirty: true });
    methods.setValue("type", preset.type, { shouldValidate: true, shouldDirty: true });
    methods.setValue("baseUnitId", "", { shouldValidate: true, shouldDirty: true });
    methods.setValue("conversionFactor", 1, { shouldValidate: true, shouldDirty: true });
  };

  const typeOptions = [
    { label: "Count (Standard Pieces, Packs)", value: "count" },
    { label: "Size (Apparel sizes: S, M, L, Waist)", value: "size" },
    { label: "Weight (KG, Grams)", value: "weight" },
    { label: "Volume (Litre, ML)", value: "volume" },
  ];

  const baseUnitOptions = [
    { label: "No Base Unit (Standard Retail Unit)", value: "" },
    ...filteredBaseUnits.map((unit) => ({
      label: `${unit.name} (${unit.code})`,
      value: unit.id,
    })),
  ];

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(async (data) => {
          await onSubmit({
            ...data,
            baseUnitId: data.baseUnitId ? data.baseUnitId : null,
          });
        })}
        className="space-y-5"
      >
          {/* Quick presets for common apparel & retail units */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Quick Presets for Clothing & Retail:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {APPAREL_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-neutral-800 transition hover:bg-amber-100 hover:text-amber-900 cursor-pointer"
                >
                  + {preset.name} ({preset.code})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput
              name="name"
              label="Unit Name"
              placeholder="e.g. Piece, Waist 32, Small"
              required
            />

            <FormInput
              name="code"
              label="Unit Code"
              placeholder="e.g. PC, 32, S"
              required
            />
          </div>

          <FormSelect
            name="type"
            label="Unit Type"
            options={typeOptions}
            placeholder="Select unit type"
            required
          />

          {/* Collapsible advanced conversion section for wholesale/ERP */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="flex w-full cursor-pointer items-center justify-between text-left"
            >
              <span className="text-xs font-semibold text-neutral-700">
                Advanced: Base Units & Conversion Factors (Optional)
              </span>
              <ChevronDown
                className={`h-4 w-4 text-neutral-400 transition-transform ${showAdvanced ? "rotate-180" : ""
                  }`}
              />
            </button>

              {showAdvanced ? (
                <div className="mt-3 space-y-4 border-t border-neutral-200/70 pt-3">
                  <p className="text-[11px] text-neutral-500">
                    Only needed if this unit is a bulk package converting into a smaller base unit (e.g., 1 Box = 12 Pieces).
                  </p>
                  <FormSelect
                    name="baseUnitId"
                    label="Base Unit"
                    options={baseUnitOptions}
                    placeholder="Select base unit"
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormInput
                      name="conversionFactor"
                      label="Conversion Factor"
                      type="number"
                      step="any"
                      min="0"
                      placeholder="1"
                      required
                    />

                    <FormInput
                      name="sortOrder"
                      label="Sort Order"
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      placeholder="0"
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-neutral-400">
                  Standard retail units sell 1:1 with no base unit or conversion required.
                </p>
              )}
            </div>

              <div className="flex justify-end pt-2">
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