"use client";

import * as React from "react";
import { QueryProvider } from "./QueryProvider";
import { AuthProvider } from "./AuthProvider";
import { AccountBlockedGate } from "@/components/auth/AccountBlockedGate";
import { ToastProvider } from "@/components/ui/Toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <QueryProvider>
          {children}
          <AccountBlockedGate />
        </QueryProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
