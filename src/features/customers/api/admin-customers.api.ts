import { apiClient } from "@/lib/api/api-client";
import type {
  AdminCustomerListInput,
  AdminCustomerOrdersInput,
} from "../validations/admin-customer.schema";
import type {
  AdminCustomerListItemDto,
  AdminCustomerDetailDto,
  AdminCustomerAddressDto,
  AdminCustomerOrderItemDto,
  AdminCustomerListResponse,
  AdminCustomerOrdersResponse,
  AdminCustomerCartDto,
  AdminCustomersCountResponse,
} from "../types/admin-customer.types";
import type { CustomerWishlistResponse } from "@/features/wishlist/types/wishlist.types";

export async function getAdminCustomers(
  params?: Partial<AdminCustomerListInput>
): Promise<AdminCustomerListResponse> {
  const response = await apiClient.post<AdminCustomerListItemDto[]>(
    "/api/admin/customers",
    params ?? {
      page: 1,
      pageSize: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    }
  );

  return {
    data: response.data ?? [],
    meta: (response.meta as AdminCustomerListResponse["meta"]) ?? {
      page: params?.page ?? 1,
      limit: params?.pageSize ?? 20,
      pageSize: params?.pageSize ?? 20,
      total: response.data?.length ?? 0,
      totalPages: 1,
    },
  };
}

export async function getAdminCustomerDetail(
  idOrUuid: string
): Promise<AdminCustomerDetailDto | AdminCustomerListItemDto> {
  const cleanId = idOrUuid.trim();

  // 1. Try real single customer endpoint: GET /api/admin/customers/:uuid
  try {
    const response = await apiClient.get<AdminCustomerDetailDto>(
      `/api/admin/customers/${encodeURIComponent(cleanId)}`
    );
    if (response.data) {
      return response.data;
    }
  } catch {
    // If not found or error, fall back to list search
  }

  // 2. Fallback search across customer list (for cust_id, email, or phone)
  const searchResult = await getAdminCustomers({
    search: cleanId,
    pageSize: 20,
  });

  const match =
    searchResult.data.find(
      (c) =>
        c.id === cleanId ||
        c.userId === cleanId ||
        (c.customerId && c.customerId.toLowerCase() === cleanId.toLowerCase())
    ) || searchResult.data[0];

  if (!match) {
    throw new Error(`Customer with ID '${idOrUuid}' not found.`);
  }

  return {
    ...match,
    id: match.userId || match.id,
  };
}

export async function getAdminCustomerAddresses(
  uuid: string
): Promise<AdminCustomerAddressDto[]> {
  const cleanUuid = uuid.trim();
  const response = await apiClient.get<AdminCustomerAddressDto[]>(
    `/api/admin/customers/${encodeURIComponent(cleanUuid)}/addresses`
  );
  return response.data ?? [];
}

export async function getAdminCustomerOrders(
  uuid: string,
  params?: Partial<AdminCustomerOrdersInput>
): Promise<AdminCustomerOrdersResponse> {
  const cleanUuid = uuid.trim();
  const response = await apiClient.post<AdminCustomerOrderItemDto[]>(
    `/api/admin/customers/${encodeURIComponent(cleanUuid)}/orders`,
    params ?? {
      page: 1,
      pageSize: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    }
  );
  

  return {
    data: response.data ?? [],
    meta: (response.meta as AdminCustomerOrdersResponse["meta"]) ?? {
      page: params?.page ?? 1,
      limit: params?.pageSize ?? 20,
      pageSize: params?.pageSize ?? 20,
      total: response.data?.length ?? 0,
      totalPages: 1,
    },
  };
}

export async function getAdminCustomerWishlist(
  uuid: string
): Promise<CustomerWishlistResponse> {
  const cleanUuid = uuid.trim();
  const response = await apiClient.get<CustomerWishlistResponse>(
    `/api/admin/customers/${encodeURIComponent(cleanUuid)}/wishlist`
  );
  return response.data ?? { items: [], totalItems: 0 };
}

export async function getAdminCustomerCart(
  uuid: string
): Promise<AdminCustomerCartDto | null> {
  const cleanUuid = uuid.trim();
  const response = await apiClient.get<AdminCustomerCartDto | null>(
    `/api/admin/customers/${encodeURIComponent(cleanUuid)}/cart`
  );
  return response.data ?? null;
}

export async function updateCustomerStatus(
  uuid: string,
  isActive: boolean,
  blockReason?: string
): Promise<AdminCustomerDetailDto> {
  const cleanUuid = uuid.trim();
  const response = await apiClient.put<AdminCustomerDetailDto>(
    `/api/admin/customers/${encodeURIComponent(cleanUuid)}/status`,
    isActive ? { isActive } : { isActive, blockReason }
  );
  return response.data!;
}

export async function countAdminCustomers(
  params?: Partial<AdminCustomerListInput>
): Promise<AdminCustomersCountResponse> {
  const response = await apiClient.post<AdminCustomersCountResponse>(
    "/api/admin/customers/count",
    params ?? {}
  );
  return (
    response.data ?? {
      active: 0,
      inactive: 0,
      blocked: 0,
      unblocked: 0,
      verified: 0,
      unverified: 0,
      male: 0,
      female: 0,
      other: 0,
      all: 0,
    }
  );
}

