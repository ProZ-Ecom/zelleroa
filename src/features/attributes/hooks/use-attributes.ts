"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { attributeKeys } from "@/lib/api/query-keys";
import {
  getAdminAttributes,
  getAdminAttribute,
  getAttributesForProduct,
  getConfiguredAttributesForProduct,
  getAttributeValuesForStyle,
} from "../api/get-attributes";
import type { GetAdminAttributesParams } from "../types";

export function useAdminAttributes(params?: GetAdminAttributesParams) {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params?.search) queryParams.search = params.search;
  if (params?.page) queryParams.page = params.page;
  if (params?.pageSize) queryParams.pageSize = params.pageSize;
  if (params?.type) queryParams.type = params.type;
  if (params?.multipleSelection !== undefined) {
    queryParams.multipleSelection = String(params.multipleSelection);
  }

  return useQuery({
    queryKey: attributeKeys.list(queryParams),
    queryFn: () => getAdminAttributes(queryParams),
    placeholderData: keepPreviousData,
  });
}

export function useAdminAttribute(uuid: string | null) {
  return useQuery({
    queryKey: attributeKeys.detail(uuid ?? ""),
    queryFn: () => getAdminAttribute(uuid!),
    enabled: !!uuid,
  });
}

/** Every active attribute, flagged with whether it's configured on this Product -
 * powers the Product edit "Attributes" checkbox panel. */
export function useAttributesForProduct(productUuid: string | null) {
  return useQuery({
    queryKey: [...attributeKeys.all, "by-product", productUuid],
    queryFn: () => getAttributesForProduct(productUuid!),
    enabled: !!productUuid,
  });
}

/** The Product's configured attributes WITH their values - powers the
 * single-variant Add/Edit Item form and the bulk Generate Variants form. */
export function useConfiguredAttributesForProduct(productUuid: string | null) {
  return useQuery({
    queryKey: [...attributeKeys.all, "configured-values", productUuid],
    queryFn: () => getConfiguredAttributesForProduct(productUuid!),
    enabled: !!productUuid,
  });
}

/** The Product's configured attributes, grouped with this Item's currently
 * selected values - powers the Item form's "Attributes" (value-selection) section. */
export function useStyleAttributeValues(productUuid: string | null, styleUuid: string | null) {
  return useQuery({
    queryKey: [...attributeKeys.all, "style-values", productUuid, styleUuid],
    queryFn: () => getAttributeValuesForStyle(productUuid!, styleUuid!),
    enabled: !!productUuid && !!styleUuid,
  });
}
