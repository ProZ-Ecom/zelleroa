"use client";

import * as React from "react";
import { AppProviders } from "./AppProviders";
import { NavigationProgress } from "@/components/common/NavigationProgress";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <NavigationProgress />
      {children}
    </AppProviders>
  );
}
