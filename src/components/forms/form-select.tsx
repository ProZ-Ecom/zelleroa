"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Select, type SelectOption } from "@/components/ui/select";
import { Label } from "./label";

interface FormSelectProps {
  name: string;
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  description?: string;
  required?: boolean;
  searchable?: boolean;
  expandContainer?: boolean;
  portal?: boolean;
  align?: "left" | "right";
  /** Small action shown on the label row, e.g. "+ Add brand". */
  labelAction?: React.ReactNode;
}

function FormSelect({
  name,
  label,
  options,
  placeholder,
  description,
  required,
  searchable,
  expandContainer,
  portal,
  align,
  labelAction,
}: FormSelectProps) {
  const { control, formState } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          {label && (
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={name}>
                {label}
                {required && <span className="text-error-600 font-bold ml-1">*</span>}
              </Label>
              {labelAction}
            </div>
          )}
          <Select
            {...field}
            options={options}
            placeholder={placeholder}
            searchable={searchable}
            expandContainer={expandContainer}
            portal={portal}
            align={align}
            error={fieldState.error?.message}
          />
          {description && !fieldState.error && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
    />
  );
}

export { FormSelect };
