"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ClearFiltersButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

function ClearFiltersButton({ onClick, className, label = "Clear Filters" }: ClearFiltersButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-10 px-3 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl flex items-center gap-1.5 self-start sm:self-auto shrink-0 whitespace-nowrap cursor-pointer",
        className
      )}
    >
      <RotateCcw className="h-3.5 w-3.5 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </Button>
  );
}

export { ClearFiltersButton };
