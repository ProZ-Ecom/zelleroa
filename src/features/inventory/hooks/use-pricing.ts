"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import * as api from "../api/pricing.api";
import type { PricingListParams } from "../types/pricing";

const KEY = "inventory";

function clean<T extends object>(p: T) {
  return Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false)
  ) as T;
}

export function usePricing(params: PricingListParams) {
  const q = clean(params);
  return useQuery({
    queryKey: [KEY, "pricing", q],
    queryFn: () => api.getPricing(q),
    placeholderData: keepPreviousData,
  });
}

export function useApplyPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.applyPricing(body),
    onSuccess: (summary) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      // Prices show on product and variant screens too, so those go stale.
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["variants"] });
      if (summary.updated === 0) {
        toast.error(summary.skipped[0]?.reason ?? "Nothing was changed");
        return;
      }
      const skipped = summary.skipped.length ? `, ${summary.skipped.length} left unchanged` : "";
      toast.success(
        `${summary.updated} price${summary.updated === 1 ? "" : "s"} updated${skipped}`
      );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not update prices"),
  });
}
