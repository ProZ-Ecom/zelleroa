"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string | number;
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
  onOpenChange?: (open: boolean) => void;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "warm" | "ghost";
  /** Always show the search box. Defaults to on only for lists of 7+ options. */
  searchable?: boolean;
  portal?: boolean;
  align?: "left" | "right";
  expandContainer?: boolean;
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
      onOpenChange,
      name,
      id,
      icon,
      leftIcon,
      rightIcon,
      size = "md",
      variant = "default",
      searchable,
      portal = false,
      align = "left",
      expandContainer = false,
      ...props
    },
    ref
  ) => {
    const [mounted, setMounted] = React.useState(false);
    const [isOpen, setIsOpenState] = React.useState(false);

    const setIsOpen = React.useCallback(
      (action: boolean | ((prev: boolean) => boolean)) => {
        setIsOpenState((prev) => {
          const next = typeof action === "function" ? action(prev) : action;
          if (next !== prev) {
            onOpenChange?.(next);
          }
          return next;
        });
      },
      [onOpenChange]
    );

    const [internalValue, setInternalValue] = React.useState<string>(
      (controlledValue !== undefined
        ? controlledValue
        : defaultValue !== undefined
        ? defaultValue
        : "") as string
    );
    const [searchQuery, setSearchQuery] = React.useState("");
    const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({});
    const [isUpward, setIsUpward] = React.useState(false);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const hiddenSelectRef = React.useRef<HTMLSelectElement | null>(null);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    // Sync controlled value if passed
    React.useEffect(() => {
      if (controlledValue !== undefined) {
        setInternalValue(String(controlledValue));
      }
    }, [controlledValue]);

    const isSearchable =
      searchable !== undefined ? searchable : options.length > 6;

    // Position calculation for Portaled Menu only
    const updatePosition = React.useCallback(() => {
      if (!portal || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const menuHeight = 260;
      const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      setIsUpward(openUp);

      const minMenuWidth = Math.max(rect.width, isSearchable ? 200 : 160);
      let computedLeft = align === "right" ? rect.right - minMenuWidth : rect.left;

      // Ensure dropdown stays inside viewport horizontally
      if (typeof window !== "undefined") {
        if (computedLeft + minMenuWidth > window.innerWidth - 8) {
          computedLeft = window.innerWidth - minMenuWidth - 8;
        }
        if (computedLeft < 8) {
          computedLeft = 8;
        }
      }

      const maxAvailableHeight = openUp
        ? Math.max(120, spaceAbove - 16)
        : Math.max(120, spaceBelow - 16);

      setMenuStyle({
        position: "fixed",
        left: `${computedLeft}px`,
        width: `${rect.width}px`,
        minWidth: `${minMenuWidth}px`,
        maxWidth: "calc(100vw - 16px)",
        top: openUp ? "auto" : `${rect.bottom + 4}px`,
        bottom: openUp ? `${window.innerHeight - rect.top + 4}px` : "auto",
        maxHeight: `${Math.min(320, maxAvailableHeight)}px`,
        zIndex: 99999,
      });
    }, [portal, align, isSearchable]);

    React.useEffect(() => {
      if (isOpen && portal) {
        updatePosition();
      }
    }, [isOpen, portal, updatePosition]);

    // Handle outside click & repositioning
    React.useEffect(() => {
      if (!isOpen) return;

      if (portal) {
        updatePosition();
      }

      function handleClickOutside(event: MouseEvent) {
        const target = event.target as Node;
        if (portal) {
          if (
            triggerRef.current &&
            !triggerRef.current.contains(target) &&
            menuRef.current &&
            !menuRef.current.contains(target)
          ) {
            setIsOpen(false);
            setSearchQuery("");
          }
        } else {
          if (containerRef.current && !containerRef.current.contains(target)) {
            setIsOpen(false);
            setSearchQuery("");
          }
        }
      }

      function handleScrollOrResize() {
        if (isOpen && portal) {
          updatePosition();
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      if (portal) {
        window.addEventListener("scroll", handleScrollOrResize, true);
        window.addEventListener("resize", handleScrollOrResize);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        if (portal) {
          window.removeEventListener("scroll", handleScrollOrResize, true);
          window.removeEventListener("resize", handleScrollOrResize);
        }
      };
    }, [isOpen, portal, updatePosition, setIsOpen]);

    const showSearch = searchable ?? options.length > 6;

    // Focus search input when dropdown opens without causing scroll jumps
    React.useEffect(() => {
      if (isOpen && showSearch) {
        const timeout = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timeout);
      }
    }, [isOpen, showSearch]);

    // Keyboard navigation (Escape to close, ArrowDown to open)
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

      const newValue = String(option.value);
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

    const sizeClass =
      size === "sm"
        ? "ui-dropdown-trigger-sm"
        : size === "lg"
        ? "ui-dropdown-trigger-lg"
        : "ui-dropdown-trigger-md";

    const effectiveRightIcon = rightIcon || icon;

    const menuContent = (
      <div
        ref={menuRef}
        style={portal ? menuStyle : undefined}
        className={cn(
          portal
            ? "overflow-hidden rounded-xl border border-theme-border bg-theme-surface shadow-2xl animate-in zoom-in-95 duration-150"
            : "absolute left-0 right-0 top-full z-[60] mt-1.5 overflow-hidden rounded-xl border border-theme-border bg-theme-surface shadow-lg animate-in zoom-in-95 duration-150 min-w-[160px]"
        )}
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
        <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-theme-text-muted">
              No matching options found
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected =
                String(option.value) === String(internalValue) &&
                String(option.value) !== "";

              return (
                <div
                  key={String(option.value)}
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
      </div>
    );

    return (
      <div
        ref={containerRef}
        className={cn("ui-dropdown-wrapper relative", className)}
        onKeyDown={handleKeyDown}
      >
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
            <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom Select Trigger Button */}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          data-state={isOpen ? "open" : "closed"}
          onClick={() => {
            if (!disabled) {
              setIsOpen((prev) => !prev);
            }
          }}
          className={cn(
            "ui-dropdown-trigger",
            sizeClass,
            error && "ui-dropdown-trigger-error"
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
            {leftIcon && (
              <span className="shrink-0 text-neutral-400">{leftIcon}</span>
            )}
            <span
              className={cn(
                "truncate",
                !selectedOption || selectedOption.value === ""
                  ? "text-neutral-400 font-normal"
                  : "text-neutral-800 font-medium"
              )}
            >
              {selectedOption && selectedOption.value !== ""
                ? selectedOption.label
                : placeholder}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
            {effectiveRightIcon && (
              <span className="text-neutral-400">{effectiveRightIcon}</span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-neutral-400 transition-transform duration-200",
                isOpen && "rotate-180 text-neutral-900"
              )}
            />
          </div>
        </button>

        {/* Floating overlay or Portaled dropdown */}
        {isOpen && (
          portal && mounted && typeof document !== "undefined"
            ? createPortal(menuContent, document.body)
            : menuContent
        )}

        {/* Error message */}
        {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select, Select as Dropdown };
