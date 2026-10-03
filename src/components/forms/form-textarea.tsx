"use client";

import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "./label";

interface FormTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  label?: string;
  description?: string;
  required?: boolean;
}

function FormTextarea({
  name,
  label,
  description,
  className,
  required,
  ...props
}: FormTextareaProps) {
  const { control, formState } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState, formState }) => {
        const hasError =
          (fieldState.isTouched || formState.isSubmitted) &&
          Boolean(fieldState.error);
        const errorMessage = hasError ? fieldState.error?.message : undefined;

        return (
          <div className="space-y-2">
            {label && (
              <Label htmlFor={name}>
                {label}
                {required && (
                  <span className="text-error-600 font-bold ml-1">*</span>
                )}
              </Label>
            )}
            <Textarea
              id={name}
              {...field}
              {...props}
              error={errorMessage}
            />
            {description && !hasError && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        );
      }}
    />
  );
}

export { FormTextarea };
