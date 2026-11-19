"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  error?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, checked, onChange, id: customId, ...props }, ref) => {
    const generatedId = React.useId();
    const id = customId || generatedId;

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={id}
          className="inline-flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              id={id}
              ref={ref}
              checked={checked}
              onChange={onChange}
              className="peer sr-only"
              {...props}
            />
            <div
              className={cn(
                "h-5 w-5 shrink-0 rounded border border-neutral-300 bg-white transition-all flex items-center justify-center",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-secondary-600/30",
                "peer-checked:border-secondary-600 peer-checked:bg-secondary-600 peer-checked:[&>svg]:opacity-100",
                "group-hover:border-secondary-600",
                "peer-aria-[invalid=true]:border-error-500 peer-aria-[invalid=true]:ring-2 peer-aria-[invalid=true]:ring-error-500/30",
                "disabled:cursor-not-allowed disabled:opacity-50",
                error && "border-error-500",
                className
              )}
            >
              <Check className="h-3.5 w-3.5 stroke-[3] text-white opacity-0 transition-opacity" />
            </div>
          </div>

          {label && (
            <span className="text-sm font-medium leading-none text-neutral-700 group-hover:text-neutral-900">
              {label}
            </span>
          )}
        </label>

        {error && <span className="mt-1 text-xs text-red-500 font-medium">{error}</span>}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
