import { apiClient } from "@/lib/api/api-client";
import type {
  StaffResponse,
  StaffAssignableRole,
  GetStaffParams,
  GetStaffResult,
  AdminStaffCountResponse,
} from "../types";
import type {
  CreateStaffInput,
  UpdateStaffInput,
} from "../validations/staff.schema";

export async function getStaffList(
  params?: GetStaffParams
): Promise<GetStaffResult> {
  const page = Number(params?.page) || 1;
  const limit = Number(params?.limit ?? params?.pageSize) || 10;

  const queryParams: Record<string, unknown> = {
    page,
    limit,
    pageSize: limit,
    sortBy: params?.sortBy ?? "name",
    sortOrder: params?.sortOrder ?? "asc",
  };

  if (params?.search && params.search.trim() !== "") {
    queryParams.search = params.search.trim();
  }

  if (params?.isActive !== undefined) {
    queryParams.isActive = params.isActive;
  }

  const response = await apiClient.post<StaffResponse[]>(
    "/api/admin/staff/list",
    queryParams
  );

  const responseMeta = response.meta as GetStaffResult["meta"] | undefined;
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

export async function getStaffByUuid(uuid: string): Promise<StaffResponse> {
  const response = await apiClient.get<StaffResponse>(
    `/api/admin/staff/${encodeURIComponent(uuid)}`
  );

  if (!response.data) {
    throw new Error(response.message || "Staff member not found");
  }

  return response.data;
}

export async function createStaff(
  data: CreateStaffInput
): Promise<StaffResponse> {
  const response = await apiClient.post<StaffResponse>(
    "/api/admin/staff",
    data
  );

  if (!response.data) {
    throw new Error(response.message || "Failed to create staff member");
  }

  return response.data;
}

export async function updateStaff(
  uuid: string,
  data: UpdateStaffInput
): Promise<StaffResponse> {
  const response = await apiClient.put<StaffResponse>(
    `/api/admin/staff/${encodeURIComponent(uuid)}`,
    data
  );

  if (!response.data) {
    throw new Error(response.message || "Failed to update staff member");
  }

  return response.data;
}

/**
 * Fetch staff counts breakdown (active, inactive, all).
 * Postman: POST /api/admin/staff/count
 */
export async function getStaffCount(
  params?: Partial<GetStaffParams>
): Promise<AdminStaffCountResponse> {
  const queryParams: Record<string, unknown> = {};

  if (params?.search && params.search.trim() !== "") {
    queryParams.search = params.search.trim();
  }

  if (params?.isActive !== undefined) {
    queryParams.isActive = params.isActive;
  }

  const response = await apiClient.post<AdminStaffCountResponse>(
    "/api/admin/staff/count",
    queryParams
  );

  return (
    response.data ?? {
      active: 0,
      inactive: 0,
      all: 0,
    }
  );
}


/** Roles the Staff screen may assign (active admin-panel roles, owners excluded). */
export async function getAssignableStaffRoles(): Promise<StaffAssignableRole[]> {
  const response = await apiClient.get<StaffAssignableRole[]>("/api/admin/staff/roles");
  return response.data ?? [];
}
