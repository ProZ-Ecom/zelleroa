"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attributeKeys } from "@/lib/api/query-keys";
import {
  createAttribute,
  updateAttribute,
  deleteAttribute,
  addAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  setAttributesForProduct,
  setAttributeValuesForStyle,
} from "../api/get-attributes";
import type { VariationLevel } from "../types";

export function useCreateAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createAttribute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attributeKeys.all });
    },
  });
}

export function useUpdateAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Record<string, unknown> }) =>
      updateAttribute(uuid, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: attributeKeys.all });
      queryClient.invalidateQueries({ queryKey: attributeKeys.detail(variables.uuid) });
    },
  });
}

export function useDeleteAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => deleteAttribute(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attributeKeys.all });
    },
  });
}

export function useAddAttributeValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attributeUuid,
      value,
      priceAdjustment,
      colorHex,
      imageUrl,
    }: {
      attributeUuid: string;
      value: string;
      priceAdjustment?: number;
      colorHex?: string;
      imageUrl?: string;
    }) => addAttributeValue(attributeUuid, value, priceAdjustment, colorHex, imageUrl),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: attributeKeys.all });
      queryClient.invalidateQueries({ queryKey: attributeKeys.detail(variables.attributeUuid) });
    },
  });
}

export function useUpdateAttributeValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attributeUuid,
      valueUuid,
      value,
      priceAdjustment,
      colorHex,
      imageUrl,
    }: {
      attributeUuid: string;
      valueUuid: string;
      value: string;
      priceAdjustment?: number;
      colorHex?: string;
      imageUrl?: string;
    }) => updateAttributeValue(attributeUuid, valueUuid, value, priceAdjustment, colorHex, imageUrl),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: attributeKeys.all });
      queryClient.invalidateQueries({ queryKey: attributeKeys.detail(variables.attributeUuid) });
    },
  });
}

export function useDeleteAttributeValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attributeUuid, valueUuid }: { attributeUuid: string; valueUuid: string }) =>
      deleteAttributeValue(attributeUuid, valueUuid),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: attributeKeys.all });
      queryClient.invalidateQueries({ queryKey: attributeKeys.detail(variables.attributeUuid) });
    },
  });
}

export function useSetAttributesForProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      productUuid,
      attributes,
      force,
    }: {
      productUuid: string;
      attributes: { attributeId: string; variationLevel: VariationLevel }[];
      force?: boolean;
    }) => setAttributesForProduct(productUuid, attributes, force),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...attributeKeys.all, "by-product", variables.productUuid],
      });
    },
  });
}

export function useSetAttributeValuesForStyle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      productUuid,
      styleUuid,
      attributeValueIds,
    }: {
      productUuid: string;
      styleUuid: string;
      attributeValueIds: string[];
    }) => setAttributeValuesForStyle(productUuid, styleUuid, attributeValueIds),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...attributeKeys.all, "style-values", variables.productUuid, variables.styleUuid],
      });
    },
  });
}
