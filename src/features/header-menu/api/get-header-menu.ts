import { apiClient } from "@/lib/api/api-client";
import type { AdminHeaderMenuItemResponse, HeaderNavItem } from "../types";

export async function getHeaderMenu() {
  const response = await apiClient.get<HeaderNavItem[]>("/api/customer/header-menu");
  return response.data ?? [];
}

export async function getAdminHeaderMenuItems(
  params?: Record<string, string | number | boolean | undefined | null>
) {
  const response = await apiClient.get<AdminHeaderMenuItemResponse[]>("/api/admin/header-menu", {
    params,
  });
  return response;
}

export async function getAdminHeaderMenuItem(uuid: string) {
  const response = await apiClient.get<AdminHeaderMenuItemResponse>(
    `/api/admin/header-menu/${uuid}`
  );
  return response;
}

export async function createHeaderMenuItem(data: Record<string, unknown>) {
  const response = await apiClient.post<AdminHeaderMenuItemResponse>(
    "/api/admin/header-menu",
    data
  );
  return response;
}

export async function updateHeaderMenuItem(uuid: string, data: Record<string, unknown>) {
  const response = await apiClient.put<AdminHeaderMenuItemResponse>(
    `/api/admin/header-menu/${uuid}`,
    data
  );
  return response;
}

export async function deleteHeaderMenuItem(uuid: string) {
  const response = await apiClient.delete<null>(`/api/admin/header-menu/${uuid}`);
  return response;
}
