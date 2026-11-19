"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { headerMenuKeys } from "@/lib/api/query-keys";
import {
  createHeaderMenuItem,
  updateHeaderMenuItem,
  deleteHeaderMenuItem,
} from "../api/get-header-menu";

export function useCreateHeaderMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createHeaderMenuItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: headerMenuKeys.all });
    },
  });
}

export function useUpdateHeaderMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Record<string, unknown> }) =>
      updateHeaderMenuItem(uuid, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: headerMenuKeys.all });
      queryClient.invalidateQueries({ queryKey: headerMenuKeys.detail(variables.uuid) });
    },
  });
}

export function useDeleteHeaderMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => deleteHeaderMenuItem(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: headerMenuKeys.all });
    },
  });
}
