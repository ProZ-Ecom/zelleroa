"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  inputPrefix?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      error,
      leftIcon,
      rightIcon,
      inputPrefix,
      size = "md",
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const isPassword = type === "password";
    const inputType = isPassword && showPassword ? "text" : type;

    const sizeClasses = {
      sm: "h-9 text-xs rounded-lg px-3",
      md: "h-11 text-sm rounded-xl px-4",
      lg: "h-12 text-base rounded-xl px-4",
    };

    return (
      <div className="w-full space-y-1">
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none z-10 flex items-center justify-center">
              {leftIcon}
            </div>
          )}

          {inputPrefix && (
            <div className="absolute left-10 top-1/2 flex -translate-y-1/2 items-center gap-2 text-sm text-theme-text-muted">
              <span>{inputPrefix}</span>
              <span className="h-5 w-px bg-theme-border" />
            </div>
          )}

          <input
            ref={ref}
            type={inputType}
            className={cn(
              "w-full border border-theme-border bg-theme-surface text-theme-text-primary placeholder:text-theme-text-muted transition-all outline-none",
              sizeClasses[size],
              "focus:outline-none hover:border-theme-border-accent",
              error
                ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 ring-1 ring-red-500/20"
                : "focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/20",
              leftIcon && "pl-10",
              inputPrefix && "pl-20",
              (rightIcon || isPassword) && "pr-11",
              className
            )}
            {...props}
          />

          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text-primary transition-colors cursor-pointer"
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          ) : (
            rightIcon && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted flex items-center justify-center">
                {rightIcon}
              </div>
            )
          )}
        </div>

        {error && (
          <p className="mt-1 text-xs text-red-500 font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };