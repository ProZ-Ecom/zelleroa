"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as api from "../api/valuation.api";
import type { SalesMarginParams, ValuationParams } from "../types/valuation";

const KEY = "inventory";

function clean<T extends object>(p: T) {
  return Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as T;
}

export function useStockValuation(params: ValuationParams, enabled = true) {
  const q = clean(params);
  return useQuery({
    queryKey: [KEY, "valuation", "stock", q],
    queryFn: () => api.getStockValuation(q),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSalesMargin(params: SalesMarginParams, enabled = true) {
  const q = clean(params);
  return useQuery({
    queryKey: [KEY, "valuation", "sales", q],
    queryFn: () => api.getSalesMargin(q),
    placeholderData: keepPreviousData,
    enabled,
  });
}
