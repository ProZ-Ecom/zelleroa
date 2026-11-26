import type { UnitHierarchy, UnitType } from "../validations/admin-unit.schema";
export type { UnitHierarchy, UnitType };

export interface AdminUnitResponse {
  id: string; // Public Unit UUID
  name: string;
  code: string;
  type: UnitType;
  baseUnitId: string | null; // Public Base Unit UUID
  conversionFactor: number;
  status: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetAdminUnitsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: UnitType;
  hierarchy?: UnitHierarchy;
}
