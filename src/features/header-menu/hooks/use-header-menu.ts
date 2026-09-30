"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { headerMenuKeys } from "@/lib/api/query-keys";
import {
  getHeaderMenu,
  getAdminHeaderMenuItems,
  getAdminHeaderMenuItem,
} from "../api/get-header-menu";
import type { GetAdminHeaderMenuParams } from "../types";

/** Curated storefront nav items, driving the header's desktop and mobile menus. */
export function useHeaderMenu() {
  return useQuery({
    queryKey: [...headerMenuKeys.all, "public"],
    queryFn: getHeaderMenu,
    staleTime: 10 * 60 * 1000, // near-static reference data, same convention as useCategoryTree
  });
}

export function useAdminHeaderMenuItems(params?: GetAdminHeaderMenuParams) {
  const queryParams: Record<string, string | number | undefined> = {
    page: params?.page,
    pageSize: params?.pageSize,
    search: params?.search,
  };

  return useQuery({
    queryKey: headerMenuKeys.list(queryParams),
    queryFn: () => getAdminHeaderMenuItems(queryParams),
    placeholderData: keepPreviousData,
  });
}

export function useAdminHeaderMenuItem(uuid: string | null) {
  return useQuery({
    queryKey: headerMenuKeys.detail(uuid ?? ""),
    queryFn: () => getAdminHeaderMenuItem(uuid!),
    enabled: !!uuid,
  });
}
