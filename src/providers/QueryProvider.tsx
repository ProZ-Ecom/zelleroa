"use client";

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import * as React from "react";
import { toast, getSuccessToastAttempts } from "@/components/ui/Toast";
import { ApiClientError } from "@/lib/api/api-client";

interface MetaOptions {
  skipToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // If 401 Unauthorized, apiClient already performed silent refresh and retry.
          // Do not retry 401s further in React Query to prevent infinite/duplicate loops.
          // Any other 4xx is the server rejecting the request itself (not found,
          // bad input, forbidden) - repeating it just triples the failed traffic
          // on every page, so only retry network/5xx failures.
          if (
            error instanceof ApiClientError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
    mutationCache: new MutationCache({
      onSuccess: (data: any, _variables, _context, mutation) => {
        const meta = mutation.meta as MetaOptions | undefined;
        if (meta?.skipToast) return;

        const message = meta?.successMessage || data?.message;
        if (message && typeof message === "string") {
          // The cache-level handler runs before the hook's / caller's own
          // onSuccess. If one of those shows its own success toast (with different
          // wording, so content dedupe can't catch it), keep theirs and skip this.
          const before = getSuccessToastAttempts();
          setTimeout(() => {
            if (getSuccessToastAttempts() === before) {
              toast.success("Success", message);
            }
          }, 0);
        }
      },
      onError: (error: any, _variables, _context, mutation) => {
        const meta = mutation.meta as MetaOptions | undefined;
        if (meta?.skipToast) return;

        // Only fire global error toast if explicitly requested via meta
        if (meta?.errorMessage) {
          toast.error("Error", error?.message || meta.errorMessage);
        }
      },
    }),
    queryCache: new QueryCache({
      onError: (error: any, query) => {
        const meta = query.meta as MetaOptions | undefined;
        if (meta?.skipToast) return;

        // Suppress toasts for standard query refetches unless meta.errorMessage or meta explicitly requires it
        if (meta?.errorMessage) {
          toast.error("Error", error?.message || meta.errorMessage);
        }
      },
    }),
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = React.useMemo(() => getQueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
