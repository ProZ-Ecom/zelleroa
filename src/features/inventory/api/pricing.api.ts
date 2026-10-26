import { apiClient } from "@/lib/api/api-client";
import type { PricingListParams, PricingRow, PricingSummary } from "../types/pricing";

type Params = Record<string, string | number | boolean | undefined | null>;

export async function getPricing(params: PricingListParams) {
  const res = await apiClient.get<PricingRow[]>("/api/admin/inventory/pricing", {
    params: params as Params,
  });
  return { data: res.data ?? [], meta: res.meta };
}

export async function applyPricing(body: Record<string, unknown>) {
  const res = await apiClient.post<PricingSummary>("/api/admin/inventory/pricing", body);
  return res.data as PricingSummary;
}
