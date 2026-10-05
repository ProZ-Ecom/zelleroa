"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  bodyClassName?: string;
}

const sizeStyles: Record<string, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[90vw]",
};

function FormModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  bodyClassName,
}: FormModalProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
        aria-describedby={description ? "form-modal-desc" : undefined}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] transition-all duration-200 ease-out",
          "animate-in zoom-in-95 duration-200",
          sizeStyles[size],
          className
        )}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-6 shrink-0">
          <div>
            <h2 id="form-modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            {description && (
              <p id="form-modal-desc" className="mt-1 text-sm text-gray-500">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={cn("flex-1 overflow-y-auto p-6 scrollbar-thin", bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-6 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

return createPortal(modal, document.body);
}

export { FormModal };
export type { FormModalProps };
