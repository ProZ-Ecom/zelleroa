"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getUnits, getUnit } from "../api/get-units";
import type { GetAdminUnitsParams } from "../types";
import { unitKeys } from "@/lib/api/query-keys";

export function useUnits(
  params?: GetAdminUnitsParams,
  options?: { enabled?: boolean }
) {
  const queryParams: Record<
    string,
    string | number | boolean | undefined
  > = {};

  if (params?.search) queryParams.search = params.search;
  if (params?.page) queryParams.page = params.page;
  if (params?.pageSize) queryParams.pageSize = params.pageSize;
  if (params?.type) queryParams.type = params.type;
  if (params?.hierarchy) queryParams.hierarchy = params.hierarchy;

  return useQuery({
    queryKey: unitKeys.list(queryParams),
    queryFn: () => getUnits(queryParams),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useUnit(uuid: string | null) {
  return useQuery({
    queryKey: unitKeys.detail(uuid ?? ""),
    queryFn: () => getUnit(uuid!),
    enabled: !!uuid,
  });
}