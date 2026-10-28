"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { productKeys } from "@/lib/api/query-keys";
import {
  getStoreProducts,
  getStoreProduct,
  getAdminProducts,
  getAdminProduct,
  getAdminProductImages,
  getAdminProductsCount,
} from "../api/get-products";
import type {
  AdminProductListParams,
  GetAdminProductsParams,
  AdminProductImageResponse,
} from "../types";

export function useProducts(
  params?: Record<string, unknown>,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: productKeys.list(params ?? {}),
    queryFn: () => getStoreProducts(params),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useProduct(idOrSlug: string | null) {
  return useQuery({
    queryKey: productKeys.detail(idOrSlug ?? ""),
    queryFn: () => getStoreProduct(idOrSlug!),
    enabled: !!idOrSlug,
  });
}

export function useAdminProducts(
  params?: AdminProductListParams | GetAdminProductsParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["admin", "products", "list", params ?? {}],
    queryFn: () => getAdminProducts(params),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useAdminProductsCount(params?: AdminProductListParams) {
  return useQuery({
    queryKey: ["admin", "products", "count", params ?? {}],
    queryFn: () => getAdminProductsCount(params),
    placeholderData: keepPreviousData,
  });
}

export function useAdminProduct(uuid: string | null) {
  return useQuery({
    queryKey: ["admin", "products", "detail", uuid ?? ""],
    queryFn: () => getAdminProduct(uuid!),
    enabled: !!uuid,
  });
}

export function useProductImages(
  productUuid: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery<AdminProductImageResponse[]>({
    queryKey: productUuid
      ? ([...productKeys.all, "images", productUuid] as const)
      : (["products", "images"] as const),
    queryFn: () => getAdminProductImages(productUuid!),
    enabled: !!productUuid && (options?.enabled ?? true),
  });
}

export {
  useCustomerProducts,
  useCustomerProduct,
} from "@/features/customers/hooks";
