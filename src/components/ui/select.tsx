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
  searchable?: boolean;
  align?: "left" | "right";
  /**
   * Set to true to portal the menu to document.body (useful for table footers/toolbars).
   * Default is false (standard overlay popup dropdown).
   */
  portal?: boolean;
  /**
   * Set to true for in-flow expansion (used specifically in Add Item modal to expand modal height when open).
   * Default is false (standard overlay dropdown that floats over content).
   */
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
      searchable,
      align = "left",
      portal = false,
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

    // Position calculation for Portaled Menu only
    const updatePosition = React.useCallback(() => {
      if (!portal || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const menuHeight = 240;
      const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      setIsUpward(openUp);

      const computedLeft = align === "right" ? rect.right - Math.max(rect.width, 160) : rect.left;

      setMenuStyle({
        position: "fixed",
        left: `${Math.max(8, computedLeft)}px`,
        width: `${rect.width}px`,
        minWidth: `${Math.max(rect.width, 160)}px`,
        maxWidth: "calc(100vw - 16px)",
        top: openUp ? "auto" : `${rect.bottom + 4}px`,
        bottom: openUp ? `${window.innerHeight - rect.top + 4}px` : "auto",
        zIndex: 99999,
      });
    }, [portal, align]);

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
    }, [isOpen, portal, updatePosition]);

    // Focus search input when dropdown opens
    const isSearchable =
      searchable !== undefined ? searchable : options.length > 6;

    React.useEffect(() => {
      if (isOpen && isSearchable) {
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 40);
        return () => clearTimeout(timer);
      }
    }, [isOpen, isSearchable]);

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

    const renderMenuContent = () => (
      <div
        ref={menuRef}
        style={portal ? menuStyle : undefined}
        className={cn(
          "ui-dropdown-menu",
          expandContainer
            ? "ui-dropdown-menu-inline"
            : portal
            ? isUpward
              ? "ui-dropdown-menu-up"
              : ""
            : "ui-dropdown-menu-floating"
        )}
        role="listbox"
      >
        {/* Search Input for Long Lists (>= 7 options) */}
        {isSearchable && (
          <div className="ui-dropdown-search-wrapper">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search options..."
                className="ui-dropdown-search-input"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Scrollable Options Area */}
        <div className="ui-dropdown-options-list space-y-0.5">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-neutral-400 font-medium">
              No matching options
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
                    "ui-dropdown-option",
                    isSelected && "ui-dropdown-option-selected",
                    option.disabled && "ui-dropdown-option-disabled"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {option.icon && (
                      <span className="shrink-0 text-neutral-400">{option.icon}</span>
                    )}
                    <span className="truncate">{option.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-neutral-900 ml-2" />
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
        className="ui-dropdown-wrapper relative"
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
            error && "ui-dropdown-trigger-error",
            className
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

        {/* Floating overlay by default; In-flow menu when expandContainer is true; Portal if requested */}
        {isOpen && (
          expandContainer
            ? renderMenuContent()
            : portal && mounted
            ? createPortal(renderMenuContent(), document.body)
            : renderMenuContent()
        )}

        {/* Error message */}
        {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select, Select as Dropdown };
