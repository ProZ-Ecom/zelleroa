"use client";

import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Label } from "./label";

interface FormRichTextProps {
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
}

function FormRichText({ name, label, description, placeholder, required }: FormRichTextProps) {
  const { control } = useFormContext();

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
                {required && <span className="text-error-600 font-bold ml-1">*</span>}
              </Label>
            )}
            <RichTextEditor
              id={name}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={placeholder}
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

export { FormRichText };
