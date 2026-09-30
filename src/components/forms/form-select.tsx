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
  expandContainer?: boolean;
  portal?: boolean;
}

function FormSelect({
  name,
  label,
  options,
  placeholder,
  description,
  required,
  expandContainer,
  portal,
}: FormSelectProps) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          {label && (
            <Label htmlFor={name}>
              {label}
              {required && <span className="text-error-600 font-bold ml-1">*</span>}
            </Label>
          )}
          <Select
            {...field}
            options={options}
            placeholder={placeholder}
            error={fieldState.error?.message}
            expandContainer={expandContainer}
            portal={portal}
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
