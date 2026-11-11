"use client";

import { LogOut } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export interface LogoutConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => any;
  isLoading?: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}

export function LogoutConfirmDialog({
  open,
  onClose,
  onConfirm,
  isLoading = false,
  title = "Log Out",
  description = "Are you sure you want to log out of your account?",
  confirmText = "Log Out",
  cancelText = "Cancel",
}: LogoutConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmText={confirmText}
      cancelText={cancelText}
      variant="destructive"
      icon={<LogOut className="h-6 w-6" />}
      isLoading={isLoading}
      autoClose={false}
    />
  );
}
