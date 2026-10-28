import { apiClient } from "@/lib/api/api-client";
import type {
  AttributeListItem,
  ProductAttributeConfigOption,
  ItemAttributeGroup,
  ConfiguredProductAttribute,
  VariationLevel,
} from "../types";

export interface GetAttributesResult {
  data: AttributeListItem[];
  meta: { page: number; limit: number; pageSize: number; total: number; totalPages: number };
}

export async function getAdminAttributes(
  params?: Record<string, string | number | boolean | undefined | null>
) {
  const page = Number(params?.page) || 1;
  const limit = Number(params?.pageSize) || 10;
  const response = await apiClient.get<AttributeListItem[]>("/api/admin/attributes", { params });
  const total = response.meta?.total ?? response.data?.length ?? 0;
  const totalPages = response.meta?.totalPages ?? Math.max(1, Math.ceil(total / limit));
  return {
    data: response.data ?? [],
    meta: {
      page: response.meta?.page ?? page,
      limit: response.meta?.limit ?? limit,
      pageSize: response.meta?.pageSize ?? limit,
      total,
      totalPages,
    },
  } satisfies GetAttributesResult;
}

export async function getAdminAttribute(uuid: string) {
  const response = await apiClient.get<AttributeListItem>(`/api/admin/attributes/${uuid}`);
  return response.data as AttributeListItem;
}

export async function createAttribute(data: Record<string, unknown>) {
  const response = await apiClient.post<AttributeListItem>("/api/admin/attributes", data);
  return response.data as AttributeListItem;
}

export async function updateAttribute(uuid: string, data: Record<string, unknown>) {
  const response = await apiClient.put<AttributeListItem>(`/api/admin/attributes/${uuid}`, data);
  return response.data as AttributeListItem;
}

export async function deleteAttribute(uuid: string) {
  const response = await apiClient.delete<null>(`/api/admin/attributes/${uuid}`);
  return response;
}

export async function addAttributeValue(
  attributeUuid: string,
  value: string,
  priceAdjustment?: number,
  colorHex?: string,
  imageUrl?: string
) {
  const response = await apiClient.post<AttributeListItem>(
    `/api/admin/attributes/${attributeUuid}/values`,
    { value, priceAdjustment, ...(colorHex ? { colorHex } : {}), ...(imageUrl ? { imageUrl } : {}) }
  );
  return response.data as AttributeListItem;
}

export async function updateAttributeValue(
  attributeUuid: string,
  valueUuid: string,
  value: string,
  priceAdjustment?: number,
  colorHex?: string,
  imageUrl?: string
) {
  const response = await apiClient.put<AttributeListItem>(
    `/api/admin/attributes/${attributeUuid}/values/${valueUuid}`,
    { value, priceAdjustment, ...(colorHex ? { colorHex } : {}), ...(imageUrl !== undefined ? { imageUrl } : {}) }
  );
  return response.data as AttributeListItem;
}

export async function deleteAttributeValue(attributeUuid: string, valueUuid: string) {
  const response = await apiClient.delete<AttributeListItem>(
    `/api/admin/attributes/${attributeUuid}/values/${valueUuid}`
  );
  return response.data as AttributeListItem;
}

export async function getAttributesForProduct(productUuid: string) {
  const response = await apiClient.get<ProductAttributeConfigOption[]>(
    `/api/admin/products/${productUuid}/attributes`
  );
  return response.data ?? [];
}

export async function setAttributesForProduct(
  productUuid: string,
  attributes: { attributeId: string; variationLevel: VariationLevel }[],
  force = false
) {
  const response = await apiClient.put<ProductAttributeConfigOption[]>(
    `/api/admin/products/${productUuid}/attributes`,
    { attributes, force }
  );
  return response.data ?? [];
}

export async function getConfiguredAttributesForProduct(productUuid: string) {
  const response = await apiClient.get<ConfiguredProductAttribute[]>(
    `/api/admin/products/${productUuid}/attributes/values`
  );
  return response.data ?? [];
}

export async function getAttributeValuesForItem(productUuid: string, itemUuid: string) {
  const response = await apiClient.get<ItemAttributeGroup[]>(
    `/api/admin/products/${productUuid}/items/${itemUuid}/attribute-values`
  );
  return response.data ?? [];
}

export async function setAttributeValuesForItem(
  productUuid: string,
  itemUuid: string,
  attributeValueIds: string[]
) {
  const response = await apiClient.put<ItemAttributeGroup[]>(
    `/api/admin/products/${productUuid}/items/${itemUuid}/attribute-values`,
    { attributeValueIds }
  );
  return response.data ?? [];
}
