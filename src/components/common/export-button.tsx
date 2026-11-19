"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function ExportButton({
  onClick,
  disabled = false,
  className,
  label = "Export",
}: ExportButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-9 sm:h-10 md:h-11 rounded-lg sm:rounded-xl px-3 sm:px-4 md:px-5 text-xs sm:text-sm font-semibold border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 shadow-xs shrink-0 whitespace-nowrap cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <Download className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-black" />
      <span>{label}</span>
    </Button>
  );
}
