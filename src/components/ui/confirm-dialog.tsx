"use client";

import { Modal } from "./modal";
import { Button } from "./button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => any;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  isLoading?: boolean;
  icon?: React.ReactNode;
  autoClose?: boolean;
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  isLoading,
  icon,
  autoClose = true,
}: ConfirmDialogProps) {
  const isDestructive = variant === "destructive";

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <div
          className={cn(
            "rounded-full p-3 mb-4",
            isDestructive
              ? "bg-red-50 text-red-600"
              : "bg-success-50 text-success-700"
          )}
        >
          {icon ?? (isDestructive ? (
            <AlertTriangle className="h-6 w-6" />
          ) : (
            <CheckCircle2 className="h-6 w-6" />
          ))}
        </div>
        <h3 className="text-lg font-bold text-neutral-900 mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-neutral-500 mb-6 max-w-sm leading-relaxed">{description}</p>
        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-cream-border text-neutral-700 hover:bg-cream-200 font-semibold transition-colors cursor-pointer"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            className={cn(
              "flex-1 rounded-xl font-semibold transition-colors cursor-pointer",
              !isDestructive && "bg-stone-900 hover:bg-stone-800 text-[#D4AF37] border border-[#D4AF37]/30 shadow-xs"
            )}
            onClick={async () => {
              await onConfirm();
              if (autoClose) {
                onClose();
              }
            }}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export { ConfirmDialog };
