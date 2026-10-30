"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { roleKeys, permissionKeys } from "@/lib/api/query-keys";
import {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
  getPermission,
  createPermission,
  updatePermission,
  deletePermission,
} from "../api/get-roles";

export interface GetRolesParams {
  page?: number;
  limit?: number;
  pageSize?: number;
  search?: string;
}

export function useRoles(params?: GetRolesParams) {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params?.search) queryParams.search = params.search;
  if (params?.page) queryParams.page = params.page;
  if (params?.limit ?? params?.pageSize) queryParams.limit = params?.limit ?? params?.pageSize;

  return useQuery({
    queryKey: roleKeys.list(queryParams),
    queryFn: async () => {
      const response = await getRoles(queryParams);
      return {
        data: response.data ?? [],
        meta: response.meta,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useRole(id: number | null) {
  return useQuery({
    queryKey: roleKeys.detail(id ?? 0),
    queryFn: async () => {
      const response = await getRole(id!);
      return response.data!;
    },
    enabled: !!id,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updateRole(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: permissionKeys.list(),
    queryFn: async () => {
      const response = await getPermissions();
      return response.data!;
    },
  });
}

export function usePermission(id: number | null) {
  return useQuery({
    queryKey: permissionKeys.detail(id ?? 0),
    queryFn: async () => {
      const response = await getPermission(id!);
      return response!;
    },
    enabled: !!id,
  });
}

export function useCreatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createPermission(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}

export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updatePermission(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
      queryClient.invalidateQueries({ queryKey: permissionKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}

export function useDeletePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deletePermission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
  });
}
