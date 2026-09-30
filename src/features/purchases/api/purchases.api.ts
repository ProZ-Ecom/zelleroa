import { apiClient } from "@/lib/api/api-client";
import type {
  VendorResponse,
  VendorDetailResponse,
  PurchaseOrderResponse,
  PurchaseProductOption,
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

export const updatePurchaseOrder = (uuid: string, data: Record<string, unknown>) =>
  apiClient.put<PurchaseOrderResponse>(`/api/admin/purchase-orders/${uuid}`, data);

export const actOnPurchaseOrder = (uuid: string, data: { action: string; reason?: string }) =>
  apiClient.post<PurchaseOrderResponse>(`/api/admin/purchase-orders/${uuid}/action`, data);

export const receivePurchaseOrder = (uuid: string, data: Record<string, unknown>) =>
  apiClient.post<PurchaseOrderResponse>(`/api/admin/purchase-orders/${uuid}/receive`, data);

export async function searchPurchaseProducts(search: string) {
  const res = await apiClient.get<PurchaseProductOption[]>("/api/admin/purchase-orders/products", {
    params: { search: search || undefined },
  });
  return res.data ?? [];
}
