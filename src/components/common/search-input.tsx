"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  onSearch?: (value: string) => void;
  debounceMs?: number;
  size?: "sm" | "md" | "lg";
  inputClassName?: string;
}

function SearchInput({
  className,
  inputClassName,
  onSearch,
  debounceMs = 300,
  placeholder = "Search...",
  value: propValue,
  defaultValue,
  size,
  ...props
}: SearchInputProps) {
  const [value, setValue] = React.useState(
    propValue !== undefined ? propValue : (defaultValue || "")
  );
  const onSearchRef = React.useRef(onSearch);

  React.useEffect(() => {
    if (propValue !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(propValue);
    }
  }, [propValue]);

  React.useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onSearchRef.current?.(value as string);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [value, debounceMs]);

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        size={size}
        leftIcon={<Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-theme-text-muted" />}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn(
          "h-9 sm:h-10 md:h-11 text-xs sm:text-sm rounded-lg sm:rounded-xl border-theme-border bg-theme-surface text-theme-text-primary placeholder:text-theme-text-muted hover:border-theme-border-accent focus:border-theme-primary",
          value ? "pr-8 sm:pr-10" : "",
          inputClassName
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            onSearchRef.current?.("");
          }}
          className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-primary cursor-pointer p-1 z-10"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      )}
    </div>
  );
}

export { SearchInput };
