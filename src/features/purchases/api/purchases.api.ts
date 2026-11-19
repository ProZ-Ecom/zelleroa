import { apiClient } from "@/lib/api/api-client";
import type {
  VendorResponse,
  VendorDetailResponse,
  PurchaseOrderResponse,
  PurchaseProductOption,
  PurchaseImportPreview,
  PurchaseReturnResponse,
  ReturnableOrder,
} from "../types";

type Params = Record<string, string | number | boolean | undefined | null>;

export async function getVendors(params?: Params) {
  const res = await apiClient.get<VendorResponse[]>("/api/admin/vendors", { params });
  return { data: res.data ?? [], meta: res.meta };
}

export async function getVendor(uuid: string) {
  const res = await apiClient.get<VendorDetailResponse>(`/api/admin/vendors/${uuid}`);
  return res.data as VendorDetailResponse;
}

export const createVendor = (data: Record<string, unknown>) =>
  apiClient.post<VendorResponse>("/api/admin/vendors", data);

export const updateVendor = (uuid: string, data: Record<string, unknown>) =>
  apiClient.put<VendorResponse>(`/api/admin/vendors/${uuid}`, data);

export const deleteVendor = (uuid: string) => apiClient.delete(`/api/admin/vendors/${uuid}`);

export async function getPurchaseOrders(params?: Params) {
  const res = await apiClient.get<PurchaseOrderResponse[]>("/api/admin/purchase-orders", {
    params,
  });
  return { data: res.data ?? [], meta: res.meta };
}

export async function getPurchaseOrder(uuid: string) {
  const res = await apiClient.get<PurchaseOrderResponse>(`/api/admin/purchase-orders/${uuid}`);
  return res.data as PurchaseOrderResponse;
}

export const createPurchaseOrder = (data: Record<string, unknown>) =>
  apiClient.post<PurchaseOrderResponse>("/api/admin/purchase-orders", data);

export const confirmPurchase = (data: Record<string, unknown>) =>
  apiClient.post<PurchaseOrderResponse>("/api/admin/purchase-orders/confirm", data);

export async function previewPurchaseImport(
  file: File,
  fields: { vendorId: string; invoiceNumber: string; purchaseDate: string; additionalCharges: string; notes: string }
) {
  const body = new FormData();
  body.append("file", file);
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const res = await apiClient.post<PurchaseImportPreview>("/api/admin/purchase-orders/import", body);
  return res.data as PurchaseImportPreview;
}

export interface StockSheetFilterInput {
  vendorId?: string;
  categorySlug?: string;
  brandSlug?: string;
  productSlugs?: string[];
  lowStockOnly?: boolean;
}

function stockSheetUrl(filters: StockSheetFilterInput) {
  const q = new URLSearchParams();
  if (filters.vendorId) q.set("vendorId", filters.vendorId);
  if (filters.categorySlug) q.set("categorySlug", filters.categorySlug);
  if (filters.brandSlug) q.set("brandSlug", filters.brandSlug);
  if (filters.productSlugs?.length) q.set("productSlugs", filters.productSlugs.join(","));
  if (filters.lowStockOnly) q.set("lowStockOnly", "true");
  const qs = q.toString();
  return `/api/admin/purchase-orders/stock-sheet${qs ? `?${qs}` : ""}`;
}

/**
 * Saves the stock sheet for the chosen filters.
 *
 * Fetched rather than linked to, because a selection that matches nothing comes
 * back as a JSON error: a plain link would navigate the admin to that JSON,
 * while this throws and the page can say what went wrong and stay put.
 */
export async function downloadStockSheet(filters: StockSheetFilterInput) {
  const res = await fetch(stockSheetUrl(filters), { credentials: "include" });
  if (!res.ok) {
    const message = await res
      .json()
      .then((b) => (b as { message?: string }).message)
      .catch(() => null);
    throw new Error(message || "Could not build the stock sheet");
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "stock-sheet.xlsx";
  const url = URL.createObjectURL(await res.blob());
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
  return name;
}

export const updatePurchaseOrder = (uuid: string, data: Record<string, unknown>) =>
  apiClient.put<PurchaseOrderResponse>(`/api/admin/purchase-orders/${uuid}`, data);

export const actOnPurchaseOrder = (uuid: string, data: { action: string; reason?: string }) =>
  apiClient.post<PurchaseOrderResponse>(`/api/admin/purchase-orders/${uuid}/action`, data);

export const receivePurchaseOrder = (uuid: string, data: Record<string, unknown>) =>
  apiClient.post<PurchaseOrderResponse>(`/api/admin/purchase-orders/${uuid}/receive`, data);

export async function getPurchaseReturns(params?: Params) {
  const res = await apiClient.get<PurchaseReturnResponse[]>("/api/admin/purchase-returns", {
    params,
  });
  return { data: res.data ?? [], meta: res.meta };
}

export async function getPurchaseReturn(uuid: string) {
  const res = await apiClient.get<PurchaseReturnResponse>(`/api/admin/purchase-returns/${uuid}`);
  return res.data as PurchaseReturnResponse;
}

export async function getReturnableItems(poUuid: string) {
  const res = await apiClient.get<ReturnableOrder>(
    `/api/admin/purchase-orders/${poUuid}/returnable`
  );
  return res.data as ReturnableOrder;
}

export const createPurchaseReturn = (data: Record<string, unknown>) =>
  apiClient.post<PurchaseReturnResponse>("/api/admin/purchase-returns", data);

export const updatePurchaseReturn = (uuid: string, data: Record<string, unknown>) =>
  apiClient.put<PurchaseReturnResponse>(`/api/admin/purchase-returns/${uuid}`, data);

export const actOnPurchaseReturn = (
  uuid: string,
  data: { action: string; reason?: string; debitNoteNumber?: string }
) => apiClient.post<PurchaseReturnResponse>(`/api/admin/purchase-returns/${uuid}/action`, data);

export async function searchPurchaseProducts(search: string) {
  const res = await apiClient.get<PurchaseProductOption[]>("/api/admin/purchase-orders/products", {
    params: { search: search || undefined },
  });
  return res.data ?? [];
}
