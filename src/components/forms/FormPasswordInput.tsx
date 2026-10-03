"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface FormPasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  name: string;
  label?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  required?: boolean;
}

function FormPasswordInput({
  name,
  label,
  helperText,
  leftIcon,
  className,
  required,
  ...props
}: FormPasswordInputProps) {
  const { control, formState } = useFormContext();
  const [showPassword, setShowPassword] = React.useState(false);

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
          <div className="space-y-1.5">
            {label && (
              <Label htmlFor={name}>
                {label}
                {required && (
                  <span className="text-error-600 font-bold ml-1">*</span>
                )}
              </Label>
            )}

            <div className="relative">
              {leftIcon && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {leftIcon}
                </div>
              )}

              <input
                id={name}
                {...field}
                {...props}
                type={showPassword ? "text" : "password"}
                className={cn(
                  "flex h-10 w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm outline-none transition-all duration-200",
                  "focus:outline-none focus:border-secondary-600 focus:ring-2 focus:ring-secondary-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-600/20",
                  leftIcon && "pl-10",
                  "placeholder:text-neutral-400 text-neutral-900",
                  hasError
                    ? "border-error-600 focus:border-error-600 focus:ring-error-600/20 focus-visible:border-error-600 focus-visible:ring-error-600/20"
                    : "border-neutral-200 hover:border-neutral-300",
                  className
                )}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </div>

            {hasError && (
              <p className="mt-1 text-xs text-red-500 font-medium">
                {errorMessage}
              </p>
            )}

            {!hasError && helperText && (
              <p className="text-sm text-gray-500">{helperText}</p>
            )}
          </div>
        );
      }}
    />
  );
}

export { FormPasswordInput };