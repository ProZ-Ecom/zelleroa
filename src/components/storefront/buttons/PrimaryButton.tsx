"use client";

import * as React from "react";

export interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  variant?: "yellow" | "brown" | "blue" | "primary";
  disabled?: boolean;
}

export function PrimaryButton({
  children,
  onClick,
  className = "",
  type = "button",
  variant = "primary",
  disabled = false,
}: PrimaryButtonProps) {
  const variants: Record<string, string> = {
    yellow: "bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg",
    brown: "bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg",
    blue: "bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg",
    primary: "bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        h-[40px]
        px-4
        font-semibold
        text-sm
        transition-all
        duration-150
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer"}
        ${variants[variant] || variants.primary}
        ${className}
      `}
    >
      {children}
    </button>
  );
}

export default PrimaryButton;
