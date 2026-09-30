import { apiClient } from "@/lib/api/api-client";
import type {
  StaffDeliveryListItem,
  StaffDeliveryDetailResponse,
  AdminDeliveryOrderItem,
  DeliveryStaffBasic,
  AssignDeliveryResult,
  DeliveryTransitionResult,
  StaffDeliveriesCountResponse,
  CourierShipmentResult,
} from "../types/delivery.types";
import type {
  StaffDeliveryListInput,
  MarkDeliveredInput,
  MarkFailedInput,
  AdminDeliveryOrdersListInput,
  AdminDeliveryStaffListInput,
  AssignDeliveryInput,
  ShipViaCourierInput,
} from "../validations/delivery.schema";

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/* ----------------------- Staff Delivery Flow APIs ----------------------- */

/**
 * Fetch assigned delivery list for the logged-in staff member.
 * Postman: POST /api/staff/deliveries/list
 */
export async function getStaffDeliveries(
  params?: StaffDeliveryListInput
): Promise<PaginatedResult<StaffDeliveryListItem>> {
  const page = Number(params?.page) || 1;
  const limit = Number(params?.limit) || 10;

  const body: Record<string, unknown> = {
    page,
    limit,
    sortBy: params?.sortBy ?? "createdAt",
    sortOrder: params?.sortOrder ?? "desc",
  };

  if (params?.status) {
    body.status = params.status;
  }

  if (params?.search && params.search.trim()) {
    body.search = params.search.trim();
  }

  const response = await apiClient.post<StaffDeliveryListItem[]>(
    "/api/staff/deliveries/list",
    body
  );

  const responseMeta = response.meta as PaginatedResult<StaffDeliveryListItem>["meta"] | undefined;
  const total =
    typeof responseMeta?.total === "number"
      ? responseMeta.total
      : response.data?.length ?? 0;
  const totalPages =
    typeof responseMeta?.totalPages === "number" && responseMeta.totalPages > 0
      ? responseMeta.totalPages
      : Math.max(1, Math.ceil(total / limit));

  return {
    data: response.data ?? [],
    meta: {
      page: responseMeta?.page ?? page,
      limit: responseMeta?.limit ?? limit,
      pageSize: responseMeta?.pageSize ?? limit,
      total,
      totalPages,
    },
  };
}

/**
 * Fetch detailed delivery information by shipment UUID for the logged-in staff.
 * Postman: GET /api/staff/deliveries/:uuid
 */
export async function getStaffDeliveryByUuid(
  uuid: string
): Promise<StaffDeliveryDetailResponse> {
  const response = await apiClient.get<StaffDeliveryDetailResponse>(
    `/api/staff/deliveries/${encodeURIComponent(uuid)}`
  );

  if (!response.data) {
    throw new Error(response.message || "Staff delivery details not found");
  }

  return response.data;
}

/**
 * Accept delivery assignment by staff.
 * Postman: POST /api/staff/deliveries/:uuid/accept
 */
export async function acceptDelivery(
  uuid: string
): Promise<{
  id: string;
  status: string;
  assignmentStatus: string;
  acceptedAt: Date | string | null;
}> {
  const response = await apiClient.post<{
    id: string;
    status: string;
    assignmentStatus: string;
    acceptedAt: Date | string | null;
  }>(`/api/staff/deliveries/${encodeURIComponent(uuid)}/accept`, {});

  if (!response.data) {
    throw new Error(response.message || "Failed to accept delivery");
  }

  return response.data;
}

/**
 * Mark delivery as out for delivery.
 * Postman: POST /api/staff/deliveries/:uuid/out-for-delivery
 */
export async function markOutForDelivery(
  uuid: string
): Promise<DeliveryTransitionResult> {
  const response = await apiClient.post<DeliveryTransitionResult>(
    `/api/staff/deliveries/${encodeURIComponent(uuid)}/out-for-delivery`,
    {}
  );

  if (!response.data) {
    throw new Error(response.message || "Failed to mark order as out for delivery");
  }

  return response.data;
}

/**
 * Complete delivery handover and mark as delivered.
 * Postman: POST /api/staff/deliveries/:uuid/delivered
 */
export async function markDelivered(
  uuid: string,
  input?: MarkDeliveredInput
): Promise<DeliveryTransitionResult> {
  const response = await apiClient.post<DeliveryTransitionResult>(
    `/api/staff/deliveries/${encodeURIComponent(uuid)}/delivered`,
    {
      note: input?.note || "Handed over to customer successfully",
    }
  );

  if (!response.data) {
    throw new Error(response.message || "Failed to mark delivery as delivered");
  }

  return response.data;
}

/**
 * Mark delivery as failed.
 * Postman: POST /api/staff/deliveries/:uuid/failed
 */
export async function markFailed(
  uuid: string,
  input?: MarkFailedInput
): Promise<DeliveryTransitionResult> {
  const response = await apiClient.post<DeliveryTransitionResult>(
    `/api/staff/deliveries/${encodeURIComponent(uuid)}/failed`,
    input ?? {}
  );

  if (!response.data) {
    throw new Error(response.message || "Failed to mark delivery as failed");
  }

  return response.data;
}

/**
 * Fetch staff deliveries count (today and all-time breakdown).
 * Postman: POST /api/staff/deliveries/count
 */
export async function getStaffDeliveriesCount(
  params?: Partial<StaffDeliveryListInput>
): Promise<StaffDeliveriesCountResponse> {
  const response = await apiClient.post<StaffDeliveriesCountResponse>(
    "/api/staff/deliveries/count",
    params ?? {}
  );

  return (
    response.data ?? {
      today: {
        pending: 0,
        picked_up: 0,
        in_transit: 0,
        out_for_delivery: 0,
        delivered: 0,
        failed: 0,
        total: 0,
      },
      allTime: {
        pending: 0,
        picked_up: 0,
        in_transit: 0,
        out_for_delivery: 0,
        delivered: 0,
        failed: 0,
        total: 0,
      },
    }
  );
}

/* ----------------------- Admin Delivery Overview & Dispatch APIs ----------------------- */

/**
 * Fetch all delivery orders across all staff (Admin).
 * Endpoint: POST /api/admin/delivery/orders/list
 */
export async function getAdminDeliveryOrders(
  params?: AdminDeliveryOrdersListInput
): Promise<PaginatedResult<AdminDeliveryOrderItem>> {
  const page = Number(params?.page) || 1;
  const limit = Number(params?.limit) || 10;

  const body: Record<string, unknown> = {
    page,
    limit,
    sortBy: params?.sortBy ?? "createdAt",
    sortOrder: params?.sortOrder ?? "desc",
  };

  if (params?.search && params.search.trim()) {
    body.search = params.search.trim();
  }
  if (params?.orderStatus) {
    body.orderStatus = params.orderStatus;
  }
  if (params?.deliveryStatus) {
    body.deliveryStatus = params.deliveryStatus;
  }
  if (params?.staffId) {
    body.staffId = params.staffId;
  }

  const response = await apiClient.post<AdminDeliveryOrderItem[]>(
    "/api/admin/delivery/orders/list",
    body
  );

  const responseMeta = response.meta as PaginatedResult<AdminDeliveryOrderItem>["meta"] | undefined;
  const total =
    typeof responseMeta?.total === "number"
      ? responseMeta.total
      : response.data?.length ?? 0;
  const totalPages =
    typeof responseMeta?.totalPages === "number" && responseMeta.totalPages > 0
      ? responseMeta.totalPages
      : Math.max(1, Math.ceil(total / limit));

  return {
    data: response.data ?? [],
    meta: {
      page: responseMeta?.page ?? page,
      limit: responseMeta?.limit ?? limit,
      pageSize: responseMeta?.pageSize ?? limit,
      total,
      totalPages,
    },
  };
}

/**
 * Fetch active delivery staff list for assignment (Admin).
 * Endpoint: POST /api/admin/delivery/staff/list
 */
export async function getAdminDeliveryStaff(
  params?: AdminDeliveryStaffListInput
): Promise<PaginatedResult<DeliveryStaffBasic>> {
  const page = Number(params?.page) || 1;
  const limit = Number(params?.limit) || 20;

  const body: Record<string, unknown> = {
    page,
    limit,
    isActive: params?.isActive ?? true,
    sortBy: params?.sortBy ?? "name",
    sortOrder: params?.sortOrder ?? "asc",
  };

  if (params?.search && params.search.trim()) {
    body.search = params.search.trim();
  }

  const response = await apiClient.post<DeliveryStaffBasic[]>(
    "/api/admin/delivery/staff/list",
    body
  );

  const responseMeta = response.meta as PaginatedResult<DeliveryStaffBasic>["meta"] | undefined;
  const total =
    typeof responseMeta?.total === "number"
      ? responseMeta.total
      : response.data?.length ?? 0;
  const totalPages =
    typeof responseMeta?.totalPages === "number" && responseMeta.totalPages > 0
      ? responseMeta.totalPages
      : Math.max(1, Math.ceil(total / limit));

  return {
    data: response.data ?? [],
    meta: {
      page: responseMeta?.page ?? page,
      limit: responseMeta?.limit ?? limit,
      pageSize: responseMeta?.pageSize ?? limit,
      total,
      totalPages,
    },
  };
}

/**
 * Assign packed order to delivery staff member (Admin).
 * Endpoint: POST /api/admin/delivery/assign
 */
export async function assignDelivery(
  input: AssignDeliveryInput
): Promise<AssignDeliveryResult> {
  const response = await apiClient.post<AssignDeliveryResult>(
    "/api/admin/delivery/assign",
    input
  );

  if (!response.data) {
    throw new Error(response.message || "Failed to assign delivery");
  }

  return response.data;
}

/**
 * Record an India Post shipment for a packed order (Admin).
 * Endpoint: POST /api/admin/delivery/ship-courier
 */
export async function shipViaCourier(
  input: ShipViaCourierInput
): Promise<CourierShipmentResult> {
  const response = await apiClient.post<CourierShipmentResult>(
    "/api/admin/delivery/ship-courier",
    input
  );

  if (!response.data) {
    throw new Error(response.message || "Failed to record India Post shipment");
  }

  return response.data;
}
