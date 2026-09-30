"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { useFormContext, Controller } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Label } from "./label";
import { SearchInput } from "@/components/ui/search-input";

export interface FormMultiSelectOption {
  value: string;
  label: string;
}

interface FormMultiSelectProps {
  name: string;
  label?: string;
  options: FormMultiSelectOption[];
  description?: string;
  required?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

/** Checkbox-list multi-select, RHF-native via Controller — the array-field counterpart to FormSelect. */
function FormMultiSelect({
  name,
  label,
  options,
  description,
  required,
  searchable = true,
  searchPlaceholder = "Search...",
  emptyMessage = "No options found.",
  disabled = false,
}: FormMultiSelectProps) {
  const { control } = useFormContext();
  const [search, setSearch] = React.useState("");

  const visibleOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const selected: string[] = Array.isArray(field.value) ? field.value : [];

        const toggle = (value: string) => {
          if (disabled) return;
          field.onChange(
            selected.includes(value)
              ? selected.filter((v) => v !== value)
              : [...selected, value]
          );
        };

        return (
          <div className="space-y-2">
            {label && (
              <div className="flex items-center justify-between gap-3">
                <Label>
                  {label}
                  {required && <span className="text-error-600 font-bold ml-1">*</span>}
                </Label>
                <span className="text-xs font-medium text-neutral-500">
                  {selected.length} selected
                </span>
              </div>
            )}

            {searchable && options.length > 5 && (
              <SearchInput placeholder={searchPlaceholder} onSearch={setSearch} className="max-w-md" />
            )}

            <div
              className={cn(
                "max-h-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white scrollbar-thin",
                disabled && "opacity-60"
              )}
            >
              {visibleOptions.length === 0 ? (
                <p className="p-4 text-center text-xs text-neutral-500">{emptyMessage}</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {visibleOptions.map((option) => {
                    const isSelected = selected.includes(option.value);
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          onClick={() => toggle(option.value)}
                          aria-pressed={isSelected}
                          disabled={disabled}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                            disabled ? "cursor-not-allowed" : "cursor-pointer",
                            isSelected ? "bg-emerald-50/70" : "hover:bg-neutral-50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                              isSelected
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-neutral-300 bg-white"
                            )}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="truncate font-medium text-neutral-900">
                            {option.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {description && !fieldState.error && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {fieldState.error?.message && (
              <p className="text-xs text-red-500 font-medium">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}

export { FormMultiSelect };
