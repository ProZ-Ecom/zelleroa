import { apiClient } from "@/lib/api/api-client";
import type {
  AdminProductResponse,
  GetAdminProductsResult,
  AdminProductListParams,
  GetAdminProductsParams,
  AdminProductImageResponse,
  AdminProductsCountResponse,
} from "../types";

export async function getAdminProducts(
  params?: AdminProductListParams | GetAdminProductsParams
): Promise<GetAdminProductsResult> {
  const body: Record<string, unknown> = {};

  if (params?.page) body.page = Number(params.page);
  const limitValue =
    (params as AdminProductListParams)?.limit ?? params?.pageSize;
  if (limitValue !== undefined) {
    body.limit = Number(limitValue);
    body.pageSize = Number(limitValue);
  }
  if (
    params?.search !== undefined &&
    params?.search !== null &&
    params?.search !== ""
  ) {
    body.search = String(params.search).trim();
  }

  const p = params as AdminProductListParams | undefined;
  if (p?.isActive !== undefined && p?.isActive !== null) {
    body.isActive = Boolean(p.isActive);
  }
  if (p?.categoryId) body.categoryId = String(p.categoryId);
  if (p?.brandId) body.brandId = String(p.brandId);
  if (p?.hsnCodeId) body.hsnCodeId = String(p.hsnCodeId);
  if (p?.vegType) body.vegType = p.vegType;
  if (p?.isFeatured !== undefined && p?.isFeatured !== null) {
    body.isFeatured = Boolean(p.isFeatured);
  }
  if (p?.status !== undefined && p?.status !== null) {
    body.status = Boolean(p.status);
  }
  if (p?.sortBy) body.sortBy = String(p.sortBy);
  if (p?.sortOrder) body.sortOrder = String(p.sortOrder);

  const response = await apiClient.post<AdminProductResponse[]>(
    "/api/admin/products/list",
    body
  );

  return {
    data: response.data ?? [],
    meta: response.meta,
  };
}

export async function getAdminProductsCount(
  params?: AdminProductListParams
): Promise<AdminProductsCountResponse> {
  const body: Record<string, unknown> = {};
  if (params?.search) body.search = String(params.search).trim();
  if (params?.categoryId) body.categoryId = String(params.categoryId);
  if (params?.brandId) body.brandId = String(params.brandId);
  if (params?.hsnCodeId) body.hsnCodeId = String(params.hsnCodeId);

  const response = await apiClient.post<AdminProductsCountResponse>(
    "/api/admin/products/count",
    body
  );

  return (
    response.data ?? { active: 0, inactive: 0, all: 0, withoutImage: 0 }
  );
}

export async function getAdminProduct(uuid: string) {
  return apiClient.get<AdminProductResponse>(`/api/admin/products/${uuid}`);
}

export async function createAdminProduct(data: Record<string, unknown>) {
  return apiClient.post<AdminProductResponse>("/api/admin/products", data);
}

export async function updateAdminProduct(
  uuid: string,
  data: Record<string, unknown>
) {
  return apiClient.put<AdminProductResponse>(
    `/api/admin/products/${uuid}`,
    data
  );
}

export async function deleteAdminProduct(uuid: string) {
  return apiClient.delete(`/api/admin/products/${uuid}`);
}

// Product Images API
export async function getAdminProductImages(
  productUuid: string
): Promise<AdminProductImageResponse[]> {
  const response = await apiClient.get<AdminProductImageResponse[]>(
    `/api/admin/products/${productUuid}/images`
  );
  return response.data ?? [];
}

export async function createAdminProductImages(
  productUuid: string,
  images: Array<{
    imageUrl: string;
    sortOrder?: number;
    isPrimary?: boolean;
  }>
): Promise<AdminProductImageResponse[]> {
  const response = await apiClient.post<AdminProductImageResponse[]>(
    `/api/admin/products/${productUuid}/images`,
    images
  );
  return response.data ?? [];
}

export async function updateAdminProductImage(
  productUuid: string,
  imageId: string,
  data: { imageUrl?: string; sortOrder?: number }
): Promise<AdminProductImageResponse | null> {
  const response = await apiClient.put<AdminProductImageResponse>(
    `/api/admin/products/${productUuid}/images/${imageId}`,
    data
  );
  return response.data ?? null;
}

export async function setPrimaryAdminProductImage(
  productUuid: string,
  imageId: string
): Promise<AdminProductImageResponse | null> {
  const response = await apiClient.put<AdminProductImageResponse>(
    `/api/admin/products/${productUuid}/images/${imageId}/primary`
  );
  return response.data ?? null;
}

export async function deleteAdminProductImage(
  productUuid: string,
  imageId: string
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/api/admin/products/${productUuid}/images/${imageId}`
  );
  return {
    success: response.success ?? true,
    message: response.message ?? "Product image deleted successfully",
  };
}

// Multipart File Upload Helpers
export async function uploadProductImageFile(
  file: File,
  folder: string = "products"
): Promise<{ path: string }> {
  const formData = new FormData();
  formData.append("folder", folder);
  formData.append("file", file);

  const response = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to upload image");
  }

  return result.data;
}

export async function uploadProductImageFiles(
  files: File[],
  folder: string = "products"
): Promise<{ paths: string[] }> {
  const formData = new FormData();
  formData.append("folder", folder);
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch("/api/admin/uploads", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to upload images");
  }

  return result.data;
}

export async function getStoreProducts(
  params?: Record<string, unknown>
) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        // The public /api/products endpoint accepts "limit", not "pageSize"
        query.set(key === "pageSize" ? "limit" : key, String(val));
      }
    });
  }
  const queryString = query.toString();
  const url = queryString ? `/api/products?${queryString}` : "/api/products";
  return apiClient.get<any>(url);
}

export async function getStoreProduct(idOrSlug: string) {
  return apiClient.get<any>(`/api/products/${encodeURIComponent(idOrSlug)}`);
}

// Aliases for compatibility
export const getProducts = getAdminProducts;
export const getProduct = getAdminProduct;
export const createProduct = createAdminProduct;
export const updateProduct = (
  idOrUuid: string | number,
  data: Record<string, unknown>
) => updateAdminProduct(String(idOrUuid), data);
export const deleteProduct = (idOrUuid: string | number) =>
  deleteAdminProduct(String(idOrUuid));
export const getProductImages = getAdminProductImages;
