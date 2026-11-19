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
import { ChevronDown } from "lucide-react";

type UnitFormData = {
  name: string;
  code: string;
  type: UnitType;
  baseUnitId?: string | null;
  conversionFactor?: number;
  sortOrder?: number;
};

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

  const typeOptions = [
    { label: "Count (Standard Pieces, Packs)", value: "count" },
    { label: "Size (Dimensions, Sizing)", value: "size" },
    { label: "Weight (KG, Grams)", value: "weight" },
    { label: "Volume (Litre, ML)", value: "volume" },
  ];

  const baseUnitOptions = [
    { label: "No Base Unit (Standard Unit)", value: "" },
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput
            name="name"
            label="Unit Name"
            placeholder="e.g. Kilogram, Piece, Litre"
            required
          />

            <FormInput
              name="code"
              label="Unit Code"
              placeholder="e.g. KG, PC, L"
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
      </form >
    </FormProvider >
  );
}
