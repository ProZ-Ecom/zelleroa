"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { headerMenuKeys, tagKeys } from "@/lib/api/query-keys";
import {
  assignTagProducts,
  createTag,
  deleteTag,
  getAdminTag,
  getAdminTags,
  updateTag,
} from "../api/tags.api";
import type { GetAdminTagsParams, TagProductsAction } from "../types";

export function useAdminTags(params?: GetAdminTagsParams, options?: { enabled?: boolean }) {
  const queryParams: Record<string, string | number | undefined> = {
    page: params?.page,
    pageSize: params?.pageSize,
    search: params?.search,
  };

  return useQuery({
    queryKey: tagKeys.list(queryParams),
    queryFn: () => getAdminTags(queryParams),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useAdminTag(id: string | null) {
  return useQuery({
    queryKey: tagKeys.detail(id ?? ""),
    queryFn: () => getAdminTag(id!),
    enabled: !!id,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; isActive?: boolean }) => createTag(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.all }),
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; isActive?: boolean } }) =>
      updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
      // Nav items show the tag's name and slug, so a rename must refresh them too.
      queryClient.invalidateQueries({ queryKey: headerMenuKeys.all });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
      queryClient.invalidateQueries({ queryKey: headerMenuKeys.all });
    },
  });
}

export function useAssignTagProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      productIds,
      action,
    }: {
      id: string;
      productIds: string[];
      action: TagProductsAction;
    }) => assignTagProducts(id, { productIds, action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.all }),
  });
}
