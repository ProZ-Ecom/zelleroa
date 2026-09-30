"use client";

import { useQuery, useQueries, useInfiniteQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { customerCatalogApi } from "../api/customer-catalog.api";
import type {
  CustomerBrandListInput,
  CustomerCategoryListInput,
  CustomerProductListInput,
  CustomerVariantListInput,
  CustomerGlobalVariantListInput,
} from "../validations/catalog.schema";

export const CUSTOMER_CATALOG_QUERY_KEYS = {
  all: ["customer", "catalog"] as const,
  products: (params?: CustomerProductListInput) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "products", params ?? {}] as const,
  styles: (params?: CustomerProductListInput) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "styles", params ?? {}] as const,
  listing: (category: string, queryString: string, pageSize: number) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "listing", category, queryString, pageSize] as const,
  categoryMenu: (category: string, gender?: string | null) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "category-menu", category, gender ?? null] as const,
  item: (uuid: string) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "item", uuid] as const,
  product: (uuid: string) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "product", uuid] as const,
  style: (uuid: string) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "style", uuid] as const,
  productVariants: (uuid: string, params?: CustomerVariantListInput) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "product-variants", uuid, params ?? {}] as const,
  relatedProducts: (uuid: string, limit?: number) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "related-products", uuid, limit ?? null] as const,
  variant: (productUuid: string, variantUuid: string) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "variant", productUuid, variantUuid] as const,
  categories: (params?: CustomerCategoryListInput) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "categories", params ?? {}] as const,
  category: (uuid: string) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "category", uuid] as const,
  brands: (params?: CustomerBrandListInput) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "brands", params ?? {}] as const,
  brand: (uuid: string) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "brand", uuid] as const,
  globalVariants: (params?: CustomerGlobalVariantListInput) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "global-variants", params ?? {}] as const,
  banners: (position?: string) =>
    [...CUSTOMER_CATALOG_QUERY_KEYS.all, "banners", position ?? "all"] as const,
};

/**
 * Fetch customer products with filters (brandIds, categoryIds, minPrice, maxPrice, search, sortBy, sortOrder)
 */
export function useCustomerProducts(
  params?: CustomerProductListInput,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.products(params),
    queryFn: () => customerCatalogApi.getProducts(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60, // 1 minute
    ...options,
  });
}

/**
 * Category page listing, one infinite-scroll page at a time. Keyed by the
 * category and the filter query string, so each filter combination is cached
 * on its own and the previous results stay on screen while the next load.
 */
export function useCategoryListing(category: string, queryString: string, pageSize = 24) {
  return useInfiniteQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.listing(category, queryString, pageSize),
    queryFn: ({ pageParam }) =>
      customerCatalogApi.getCategoryListing({ category, queryString, page: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
  });
}

/**
 * Header menu preview for a category - its Products and their Items. Only
 * fetched once the menu opens (`enabled`), then cached.
 */
export function useCategoryMenu(
  category: string,
  options?: { enabled?: boolean; gender?: string | null }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.categoryMenu(category, options?.gender),
    queryFn: () => customerCatalogApi.getCategoryMenu(category, options?.gender),
    enabled: !!category && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Same preview as `useCategoryMenu`, fetched in parallel for several
 * categories at once - used to fill one mega-menu column per category when a
 * nav item groups multiple categories together.
 */
export function useCategoryMenus(
  categories: string[],
  options?: { enabled?: boolean; gender?: string | null }
) {
  return useQueries({
    queries: categories.map((category) => ({
      queryKey: CUSTOMER_CATALOG_QUERY_KEYS.categoryMenu(category, options?.gender),
      queryFn: () => customerCatalogApi.getCategoryMenu(category, options?.gender),
      enabled: !!category && (options?.enabled ?? true),
      staleTime: 1000 * 60 * 5,
    })),
  });
}

/**
 * Fetch the storefront listing as Styles - one card per Style, never per
 * Item or per Color.
 */
export function useCustomerStyles(
  params?: CustomerProductListInput,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.styles(params),
    queryFn: () => customerCatalogApi.getStyles(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
    ...options,
  });
}

/**
 * Fetch one Style with its Items, and each Item's Colors/Sizes - everything
 * the Style detail page needs to switch Item, Color and Size without
 * re-fetching.
 */
export function useCustomerStyle(
  styleUuid: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.style(styleUuid ?? ""),
    queryFn: () => customerCatalogApi.getStyle(styleUuid!),
    enabled: !!styleUuid && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch one Item with its Colors, and each Color's own images, Sizes, prices
 * and stock - everything the Item detail page needs to switch Color and Size
 * without re-fetching.
 */
export function useCustomerItem(
  itemUuid: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.item(itemUuid ?? ""),
    queryFn: () => customerCatalogApi.getItem(itemUuid!),
    enabled: !!itemUuid && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch single product details by product UUID
 */
export function useCustomerProduct(
  productUuid: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.product(productUuid ?? ""),
    queryFn: () => customerCatalogApi.getProduct(productUuid!),
    enabled: !!productUuid && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch related products (same category/brand) for a given product
 */
export function useCustomerRelatedProducts(
  productUuid: string | null,
  limit?: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.relatedProducts(productUuid ?? "", limit),
    queryFn: () => customerCatalogApi.getRelatedProducts(productUuid!, limit),
    enabled: !!productUuid && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch the current customer's recently viewed products, most recent first.
 * Requires login - disabled automatically when signed out.
 */
export function useRecentlyViewedProducts(
  excludeProductUuid?: string,
  limit?: number
) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return useQuery({
    queryKey: [
      ...CUSTOMER_CATALOG_QUERY_KEYS.all,
      "recently-viewed",
      excludeProductUuid ?? null,
      limit ?? null,
    ],
    queryFn: () => customerCatalogApi.getRecentlyViewed(excludeProductUuid, limit),
    enabled: isAuthenticated,
    staleTime: 1000 * 60,
  });
}

/** Records a product view for the current customer (no-op while signed out). */
export function useRecordProductView() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const mutation = useMutation({
    mutationFn: (productUuid: string) => customerCatalogApi.recordProductView(productUuid),
  });

  return { ...mutation, isAuthenticated };
}

/**
 * Fetch categories list for filters and navigation
 */
export function useCustomerCategories(
  params?: CustomerCategoryListInput,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.categories(params),
    queryFn: () => customerCatalogApi.getCategories(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
}

/**
 * Fetch brands list for filters
 */
export function useCustomerBrands(
  params?: CustomerBrandListInput,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.brands(params),
    queryFn: () => customerCatalogApi.getBrands(params),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

/**
 * Fetch variants of a specific product
 */
export function useCustomerProductVariants(
  productUuid: string | null,
  params?: CustomerVariantListInput,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.productVariants(productUuid ?? "", params),
    queryFn: () => customerCatalogApi.getProductVariants(productUuid!, params),
    enabled: !!productUuid && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch single variant details
 */
export function useCustomerVariant(
  productUuid: string | null,
  variantUuid: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.variant(productUuid ?? "", variantUuid ?? ""),
    queryFn: () => customerCatalogApi.getVariant(productUuid!, variantUuid!),
    enabled: !!productUuid && !!variantUuid && (options?.enabled ?? true),
  });
}

/**
 * Fetch global variants list
 */
export function useCustomerGlobalVariants(
  params?: CustomerGlobalVariantListInput,
  options?: { enabled?: boolean; placeholderData?: any }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.globalVariants(params),
    queryFn: () => customerCatalogApi.getAllVariants(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
    ...options,
  });
}

/**
 * Fetch active promotional banners
 */
export function useCustomerBanners(
  position?: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.banners(position),
    queryFn: () => customerCatalogApi.getBanners(position),
    staleTime: 1000 * 60 * 10,
    ...options,
  });
}
