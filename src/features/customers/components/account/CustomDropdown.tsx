"use client";

import React from "react";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode | string;
  description?: string;
}

export interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  label,
  error,
  disabled = false,
  className = "",
  triggerClassName = "",
}: CustomDropdownProps) {
  const selectOptions: SelectOption[] = React.useMemo(() => {
    return options.map((opt) => ({
      value: opt.value,
      label: opt.description ? `${opt.label} (${opt.description})` : opt.label,
      icon: opt.icon ? (
        typeof opt.icon === "string" ? <span>{opt.icon}</span> : opt.icon
      ) : undefined,
    }));
  }, [options]);

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-theme-text-muted">
          {label}
        </span>
      )}
      <Select
        options={selectOptions}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        error={error}
        disabled={disabled}
        className={triggerClassName}
        portal={true}
      />
    </div>
  );
}
