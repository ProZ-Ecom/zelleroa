import { apiClient } from "@/lib/api/api-client";
import type {
  AdjustmentPayload,
  InventoryDashboard,
  MovementListParams,
  MovementRow,
  StockListParams,
  StockRow,
} from "../types/stock";

type Params = Record<string, string | number | boolean | undefined | null>;

export async function getInventoryDashboard() {
  const res = await apiClient.get<InventoryDashboard>("/api/admin/inventory/dashboard");
  return res.data as InventoryDashboard;
}

export async function getCurrentStock(params: StockListParams) {
  const res = await apiClient.get<StockRow[]>("/api/admin/inventory/stock", {
    params: params as Params,
  });
  return { data: res.data ?? [], meta: res.meta };
}

export async function getStockMovements(params: MovementListParams) {
  const res = await apiClient.get<MovementRow[]>("/api/admin/inventory/movements", {
    params: params as Params,
  });
  return { data: res.data ?? [], meta: res.meta };
}

export const adjustStockLevel = (data: AdjustmentPayload) =>
  apiClient.post<{ previousStock: number; newStock: number; productName: string }>(
    "/api/admin/inventory/adjust",
    data
  );

export async function getStockSettings() {
  const res = await apiClient.get<{ lowStockThreshold: number }>("/api/admin/inventory/settings");
  return res.data as { lowStockThreshold: number };
}

export const updateStockSettings = (lowStockThreshold: number) =>
  apiClient.put("/api/admin/inventory/settings", { lowStockThreshold });
