"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/api-client";
import type { PaginationMeta } from "../types";

export interface ListResult<T> {
  data: T[];
  meta: PaginationMeta;
}

type Params = Record<string, string | number | undefined>;

const EMPTY_META: PaginationMeta = { page: 1, limit: 20, total: 0, totalPages: 1 };

export async function fetchList<T>(endpoint: string, params: Params): Promise<ListResult<T>> {
  const res = await apiClient.get<T[]>(endpoint, { params });
  return { data: res.data ?? [], meta: (res.meta as PaginationMeta | undefined) ?? EMPTY_META };
}

export function useAdminList<T>(key: string, endpoint: string, params: Params) {
  return useQuery({
    queryKey: ["agents-admin", key, params],
    queryFn: () => fetchList<T>(endpoint, params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAdminObject<T>(key: string, endpoint: string, enabled = true) {
  return useQuery({
    queryKey: ["agents-admin", key, endpoint],
    queryFn: async () => (await apiClient.get<T>(endpoint)).data as T,
    enabled,
    staleTime: 15_000,
  });
}

export interface AgentOption {
  id: string;
  name: string;
  agentCode: string | null;
  isActive: boolean;
}

export function useAgentOptions() {
  return useAdminObject<AgentOption[]>("agent-options", "/api/admin/agents/options");
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof ApiClientError) {
    return err.errors?.length ? `${err.message}: ${err.errors.join(", ")}` : err.message;
  }
  return err instanceof Error ? err.message : fallback;
}
