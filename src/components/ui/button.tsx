import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/20 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-98 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-theme-primary text-theme-primary-fg hover:bg-theme-primary-hover shadow-xs font-semibold",
        primary:
          "bg-theme-primary text-theme-primary-fg hover:bg-theme-primary-hover shadow-xs font-semibold",
        gradient:
          "bg-gradient-to-b from-[var(--color-primary-400)] to-[var(--color-primary-600)] text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] hover:-translate-y-px hover:shadow-[0_10px_20px_-8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0 font-semibold",
        secondary:
          "bg-theme-secondary text-theme-secondary-fg hover:bg-theme-secondary-hover shadow-xs font-bold",
        outline:
          "border border-theme-border bg-theme-surface text-theme-text-primary hover:bg-theme-surface-alt hover:border-theme-border-accent shadow-2xs font-medium",
        ghost:
          "text-theme-text-subtle hover:bg-theme-surface-alt hover:text-theme-text-primary font-medium",
        destructive:
          "bg-theme-status-can-bg text-theme-status-can-fg hover:bg-red-100 border border-theme-status-can-fg/30 font-medium",
        danger:
          "bg-theme-status-can-bg text-theme-status-can-fg hover:bg-red-100 border border-theme-status-can-fg/30 font-medium",
        warm:
          "bg-theme-surface-alt hover:bg-theme-surface-warm border border-theme-border text-theme-text-primary font-medium",
        link:
          "text-theme-primary underline-offset-4 hover:underline font-medium",
      },
      size: {
        default: "h-11 px-4 py-2 rounded-xl text-xs sm:text-sm",
        md: "h-11 px-4 py-2 rounded-xl text-xs sm:text-sm",
        sm: "h-8 px-3 rounded-lg text-xs",
        lg: "h-12 px-6 rounded-xl text-sm font-bold",
        xl: "h-14 px-8 rounded-xl text-base font-bold",
        icon: "h-10 w-10 rounded-xl p-0",
        "icon-sm": "h-8 w-8 rounded-lg p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
