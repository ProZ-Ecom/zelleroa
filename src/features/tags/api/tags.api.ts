import { apiClient } from "@/lib/api/api-client";
import type {
  AdminTagDetailResponse,
  AdminTagResponse,
  TagProductsAction,
} from "../types";

export async function getAdminTags(
  params?: Record<string, string | number | boolean | undefined | null>
) {
  return apiClient.get<AdminTagResponse[]>("/api/admin/tags", { params });
}

export async function getAdminTag(id: string) {
  return apiClient.get<AdminTagDetailResponse>(`/api/admin/tags/${id}`);
}

export async function createTag(data: { name: string; isActive?: boolean }) {
  return apiClient.post<AdminTagResponse>("/api/admin/tags", data);
}

export async function updateTag(id: string, data: { name?: string; isActive?: boolean }) {
  return apiClient.put<AdminTagResponse>(`/api/admin/tags/${id}`, data);
}

export async function deleteTag(id: string) {
  return apiClient.delete<null>(`/api/admin/tags/${id}`);
}

export async function assignTagProducts(
  id: string,
  data: { productIds: string[]; action: TagProductsAction }
) {
  return apiClient.put<AdminTagDetailResponse>(`/api/admin/tags/${id}/products`, data);
}
