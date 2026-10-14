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
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 px-3.5 text-xs font-semibold rounded-xl border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 shadow-xs flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <Download className="h-4 w-4 shrink-0 text-neutral-500" />
      <span>{label}</span>
    </Button>
  );
}
