"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children" | "size"> {
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  onValueChange?: (value: string) => void;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "warm" | "ghost";
  /** Always show the search box. Defaults to on only for lists of 7+ options. */
  searchable?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      options = [],
      placeholder = "Select an option",
      error,
      disabled = false,
      value: controlledValue,
      defaultValue,
      onChange,
      onValueChange,
      name,
      id,
      icon,
      leftIcon,
      rightIcon,
      size = "md",
      variant = "default",
      searchable,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState<string>(
      (controlledValue !== undefined
        ? controlledValue
        : defaultValue !== undefined
        ? defaultValue
        : "") as string
    );
    const [searchQuery, setSearchQuery] = React.useState("");

    const containerRef = React.useRef<HTMLDivElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const hiddenSelectRef = React.useRef<HTMLSelectElement | null>(null);

    // Sync controlled value if passed
    React.useEffect(() => {
      if (controlledValue !== undefined) {
        setInternalValue(String(controlledValue));
      }
    }, [controlledValue]);

    const listRef = React.useRef<HTMLDivElement>(null);
    const [listPos, setListPos] = React.useState<{
      left: number;
      width: number;
      top?: number;
      bottom?: number;
      maxHeight: number;
    } | null>(null);

    // The list is portalled to <body> so scrollable/overflow-hidden parents
    // (e.g. modal bodies) can't clip it; position it from the trigger's rect.
    React.useLayoutEffect(() => {
      if (!isOpen) {
        setListPos(null);
        return;
      }
      function update() {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const gap = 6;
        const below = window.innerHeight - rect.bottom - gap - 8;
        const above = rect.top - gap - 8;
        const openUp = below < 220 && above > below;
        const space = openUp ? above : below;
        setListPos({
          left: rect.left,
          width: rect.width,
          maxHeight: Math.max(160, Math.min(space, 360)),
          ...(openUp
            ? { bottom: window.innerHeight - rect.top + gap }
            : { top: rect.bottom + gap }),
        });
      }
      update();
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
      return () => {
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
      };
    }, [isOpen]);

    // Handle outside click
    React.useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        const target = event.target as Node;
        if (
          containerRef.current &&
          !containerRef.current.contains(target) &&
          !listRef.current?.contains(target)
        ) {
          setIsOpen(false);
          setSearchQuery("");
        }
      }

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    const showSearch = searchable ?? options.length > 6;

    // Focus search input when dropdown opens
    React.useEffect(() => {
      if (isOpen && showSearch) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }, [isOpen, showSearch]);

    // Keyboard navigation (Escape to close)
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      } else if (e.key === "ArrowDown" && !isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    const handleSelectOption = (option: SelectOption) => {
      if (option.disabled || disabled) return;

      const newValue = option.value;
      if (controlledValue === undefined) {
        setInternalValue(newValue);
      }
      setIsOpen(false);
      setSearchQuery("");

      if (hiddenSelectRef.current) {
        hiddenSelectRef.current.value = newValue;
        const changeEvent = new Event("change", { bubbles: true });
        hiddenSelectRef.current.dispatchEvent(changeEvent);
      }

      if (onValueChange) {
        onValueChange(newValue);
      }

      if (onChange) {
        const syntheticEvent = {
          target: { name, value: newValue, id },
          currentTarget: { name, value: newValue, id },
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
    };

    // Filter options based on search query
    const filteredOptions = React.useMemo(() => {
      if (!searchQuery.trim()) return options;
      const query = searchQuery.toLowerCase().trim();
      return options.filter((opt) =>
        opt.label.toLowerCase().includes(query)
      );
    }, [options, searchQuery]);

    // Selected option label
    const selectedOption = options.find(
      (opt) => String(opt.value) === String(internalValue)
    );

    const sizeClasses = {
      sm: "h-9 px-3 rounded-lg text-xs",
      md: "h-11 px-3.5 rounded-xl text-xs sm:text-sm font-semibold",
      lg: "h-12 px-4 rounded-xl text-sm font-semibold",
    };

    const effectiveRightIcon = rightIcon || icon;

    return (
      <div className="w-full relative" ref={containerRef} onKeyDown={handleKeyDown}>
        {/* Hidden Native Select for Form Libraries (e.g. react-hook-form) */}
        <select
          ref={(node) => {
            hiddenSelectRef.current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLSelectElement | null>).current = node;
            }
          }}
          name={name}
          id={id}
          value={internalValue}
          onChange={onChange || (() => {})}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only pointer-events-none"
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom Select Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={cn(
            "flex w-full items-center justify-between border bg-theme-surface text-theme-text-primary transition-all text-left cursor-pointer",
            sizeClasses[size],
            "outline-none focus:outline-none focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/20",
            isOpen
              ? "border-theme-primary ring-2 ring-theme-primary/20 bg-theme-surface"
              : "border-theme-border hover:border-theme-border-accent hover:bg-theme-surface-warm",
            error && "border-theme-status-can-fg focus:border-theme-status-can-fg focus:ring-theme-status-can-fg/20",
            disabled && "cursor-not-allowed bg-theme-surface-alt opacity-60 hover:border-theme-border",
            className
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 truncate">
            {leftIcon && (
              <span className="shrink-0 text-theme-text-muted">{leftIcon}</span>
            )}
            <span
              className={cn(
                "truncate",
                !selectedOption || selectedOption.value === ""
                  ? "text-theme-text-muted font-normal"
                  : "text-theme-text-primary"
              )}
            >
              {selectedOption && selectedOption.value !== ""
                ? selectedOption.label
                : placeholder}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {effectiveRightIcon && (
              <span className="text-theme-text-muted">{effectiveRightIcon}</span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-theme-text-muted transition-transform duration-200",
                isOpen && "rotate-180 text-theme-primary"
              )}
            />
          </div>
        </button>

        {/* Custom Dropdown List - Scrollable and Contained */}
        {isOpen && listPos && createPortal(
          <div
            ref={listRef}
            style={{
              position: "fixed",
              left: listPos.left,
              width: listPos.width,
              top: listPos.top,
              bottom: listPos.bottom,
            }}
            className="z-[10000] overflow-hidden rounded-xl border border-theme-border bg-theme-surface shadow-lg animate-in zoom-in-95 duration-150 min-w-[160px]"
            role="listbox"
          >
            {/* Search Input for Long Lists (>= 7 options) */}
            {showSearch && (
              <div className="border-b border-theme-border-subtle p-2 bg-theme-surface-alt">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 h-3.5 w-3.5 text-theme-text-muted pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="h-8 w-full rounded-md border border-theme-border bg-theme-surface pl-8 pr-3 text-xs text-theme-text-primary placeholder:text-theme-text-muted outline-none focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/20"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            {/* Scrollable Options Area */}
            <div
              className="overflow-y-auto p-1.5 space-y-0.5"
              style={{ maxHeight: Math.max(120, listPos.maxHeight - (showSearch ? 52 : 0)) }}
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-theme-text-muted">
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected =
                    String(option.value) === String(internalValue) &&
                    option.value !== "";

                  return (
                    <div
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectOption(option)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs sm:text-sm transition-colors cursor-pointer select-none",
                        isSelected
                          ? "bg-theme-surface-alt font-bold text-theme-primary"
                          : "text-theme-text-primary hover:bg-theme-surface-alt hover:text-theme-primary",
                        option.disabled &&
                          "cursor-not-allowed opacity-40 hover:bg-transparent pointer-events-none select-none"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {option.icon && (
                          <span className="shrink-0 text-theme-text-muted">{option.icon}</span>
                        )}
                        <span className="truncate">{option.label}</span>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-theme-primary" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}

        {/* Error message */}
        {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select, Select as Dropdown };
