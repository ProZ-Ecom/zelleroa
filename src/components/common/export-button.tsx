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
        "h-11 rounded-xl px-5 text-sm font-semibold border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 shadow-xs shrink-0 whitespace-nowrap cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <Download className="mr-2 h-4 w-4 text-black" />
      <span>{label}</span>
    </Button>
  );
}
