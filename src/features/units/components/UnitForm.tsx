"use client";

import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAdminUnitSchema,
  type UnitType,
} from "../validations/admin-unit.schema";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { z } from "zod";

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
  const methods = useForm<UnitFormData>({
    resolver: zodResolver(createAdminUnitSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: initialData?.name || "",
      code: initialData?.code || "",
      type: initialData?.type || "weight",
      baseUnitId: initialData?.baseUnitId ?? null,
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


//     useEffect(() => {
//   const currentBaseUnitId = methods.getValues("baseUnitId");

//   const isValidBaseUnit = baseUnits.some(
//     (unit) =>
//       unit.id === currentBaseUnitId &&
//       unit.type === selectedType
//   );

//   if (!isValidBaseUnit) {
//     methods.setValue("baseUnitId", null, {
//       shouldValidate: true,
//       shouldDirty: true,
//     });
//   }
// }, [selectedType, baseUnits, methods]);

  const typeOptions = [
    
    { label: "Weight", value: "weight" },
    { label: "Volume", value: "volume" },
    { label: "Count", value: "count" },
    { label: "Size", value: "size" },
  ];

  const baseUnitOptions = [
    { label: "No Base Unit", value: "" },
    ...filteredBaseUnits.map((unit) => ({
      label: `${unit.name} (${unit.code})`,
      value: unit.id,
    })),
  ];

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(async (data) => {
          await onSubmit(data);
        })}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormInput
            name="name"
            label="Unit Name"
            placeholder="Kilogram"
            required
          />

          <FormInput
            name="code"
            label="Unit Code"
            placeholder="KG"
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

        <FormSelect
          name="baseUnitId"
          label="Base Unit"
          options={baseUnitOptions}
          placeholder="Select base unit"
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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