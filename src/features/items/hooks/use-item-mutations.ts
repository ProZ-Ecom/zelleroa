"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { itemKeys, productKeys, styleKeys, variantKeys } from "@/lib/api/query-keys";
import { createAdminItem, updateAdminItem, deleteAdminItem } from "../api/get-items";

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productUuid,
      styleUuid,
      data,
    }: {
      productUuid: string;
      styleUuid: string;
      data: Record<string, unknown>;
    }) => createAdminItem(productUuid, styleUuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: styleKeys.all });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productUuid,
      styleUuid,
      itemUuid,
      data,
    }: {
      productUuid: string;
      styleUuid: string;
      itemUuid: string;
      data: Record<string, unknown>;
    }) => updateAdminItem(productUuid, styleUuid, itemUuid, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: styleKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.itemUuid) });
      // The Item's name/slug/base price feed variant/unit-price display copy too.
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productUuid,
      styleUuid,
      itemUuid,
    }: {
      productUuid: string;
      styleUuid: string;
      itemUuid: string;
    }) => deleteAdminItem(productUuid, styleUuid, itemUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: styleKeys.all });
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
    },
  });
}
