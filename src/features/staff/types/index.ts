export interface StaffResponse {
  id: string; // Public User UUID
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: string; // role name, e.g. "STAFF" or a role the admin created
  roleId: number | null;
  status: string; // "active" | "inactive" | "banned"
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A role the Staff screen can assign. */
export interface StaffAssignableRole {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export interface GetStaffParams {
  page?: number;
  limit?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: "name" | "email" | "phone" | "createdAt" | "updatedAt" | "isActive";
  sortOrder?: "asc" | "desc";
}

export interface GetStaffResult {
  data: StaffResponse[];
  meta: {
    page: number;
    limit: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminStaffCountResponse {
  active: number;
  inactive: number;
  all: number;
}


