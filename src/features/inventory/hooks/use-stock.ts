"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import * as api from "../api/stock.api";
import type { MovementListParams, StockListParams } from "../types/stock";

const KEY = "inventory";

function clean<T extends object>(p: T) {
  return Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as T;
}

export function useInventoryDashboard() {
  return useQuery({ queryKey: [KEY, "dashboard"], queryFn: api.getInventoryDashboard });
}

export function useCurrentStock(params: StockListParams) {
  const q = clean(params);
  return useQuery({
    queryKey: [KEY, "stock", q],
    queryFn: () => api.getCurrentStock(q),
    placeholderData: keepPreviousData,
  });
}

export function useStockMovements(params: MovementListParams) {
  const q = clean(params);
  return useQuery({
    queryKey: [KEY, "movements", q],
    queryFn: () => api.getStockMovements(q),
    placeholderData: keepPreviousData,
  });
}

export function useStockSettings() {
  return useQuery({ queryKey: [KEY, "settings"], queryFn: api.getStockSettings });
}

export function useUpdateStockSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: number) => api.updateStockSettings(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      toast.success("Low-stock threshold updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
}

export function useAdjustStockLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.adjustStockLevel,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      const d = res.data;
      toast.success(d ? `Stock updated: ${d.previousStock} → ${d.newStock}` : "Stock adjusted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not adjust stock"),
  });
}
