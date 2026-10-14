import { apiClient } from "@/lib/api/api-client";
import type { RoleListItem, RoleDetail, PermissionListItem } from "../types";

export async function getRoles(params?: Record<string, string | number | boolean | undefined | null>) {
  const response = await apiClient.get<RoleListItem[]>("/api/roles", { params });
  return response;
}

export async function getRole(id: number) {
  const response = await apiClient.get<RoleDetail>(`/api/roles/${id}`);
  return response;
}

export async function createRole(data: Record<string, unknown>) {
  const response = await apiClient.post<RoleDetail>("/api/roles", data);
  return response;
}

export async function updateRole(id: number, data: Record<string, unknown>) {
  const response = await apiClient.put<RoleDetail>(`/api/roles/${id}`, data);
  return response;
}

export async function deleteRole(id: number) {
  const response = await apiClient.delete<null>(`/api/roles/${id}`);
  return response;
}

export async function getPermissions() {
  const response = await apiClient.get<PermissionListItem[]>("/api/permissions");
  return response;
}

export async function getPermission(id: number) {
  const response = await apiClient.get<PermissionListItem>(`/api/permissions/${id}`);
  return response;
}

export async function createPermission(data: Record<string, unknown>) {
  const response = await apiClient.post<PermissionListItem>("/api/permissions", data);
  return response;
}

export async function updatePermission(id: number, data: Record<string, unknown>) {
  const response = await apiClient.put<PermissionListItem>(`/api/permissions/${id}`, data);
  return response;
}

export async function deletePermission(id: number) {
  const response = await apiClient.delete<null>(`/api/permissions/${id}`);
  return response;
}
