import { apiClient } from "@/lib/api/api-client";
import type {
  SalesMarginParams,
  SalesMarginReport,
  ValuationParams,
  ValuationReport,
} from "../types/valuation";

type Params = Record<string, string | number | boolean | undefined | null>;

export async function getStockValuation(params: ValuationParams) {
  const res = await apiClient.get<ValuationReport>("/api/admin/inventory/valuation", {
    params: { ...params, view: "stock" } as Params,
  });
  return res.data as ValuationReport;
}

export async function getSalesMargin(params: SalesMarginParams) {
  const res = await apiClient.get<SalesMarginReport>("/api/admin/inventory/valuation", {
    params: { ...params, view: "sales" } as Params,
  });
  return res.data as SalesMarginReport;
}
