import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { unitRepository } from "../repositories/unit.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import type { Prisma, $Enums } from "@/generated/prisma";
import type {
  AdminUnitResponse,
  GetAdminUnitsParams,
} from "../types";
import type {
  CreateAdminUnitInput,
  UpdateAdminUnitInput,
  UnitType,
} from "../validations/admin-unit.schema";

function formatAdminUnitResponse(unit: {
  id: bigint;
  uuid: string | null;
  name: string;
  code: string;
  type: $Enums.product_units_type;
  base_unit_id: bigint | null;
  conversion_factor: Prisma.Decimal | number;
  status: boolean | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  product_units?: {
    id: bigint;
    uuid: string | null;
    name: string;
    code: string;
    type: $Enums.product_units_type;
    is_active: boolean;
  } | null;
}): AdminUnitResponse {
  const unitUuid = unit.uuid || String(unit.id);
  const baseUuid = unit.product_units?.uuid ?? null;

  return {
    id: unitUuid,
    name: unit.name,
    code: unit.code,
    type: unit.type as UnitType,
    baseUnitId: baseUuid,
    conversionFactor: Number(unit.conversion_factor),
    status: Boolean(unit.status),
    isActive: Boolean(unit.is_active),
    sortOrder: unit.sort_order,
    createdAt: unit.created_at,
    updatedAt: unit.updated_at,
  };
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

export const unitService = {
  async createAdminUnit(
    data: CreateAdminUnitInput,
    adminEmail?: string
  ): Promise<AdminUnitResponse> {
    const adminId = await getAdminInternalId(adminEmail);

    // 1. Check duplicate unit name
    const existingName = await unitRepository.findByName(data.name);
    if (existingName) {
      throw ApiError.conflict(`An active unit with name '${data.name}' already exists`);
    }

    // 2. Check duplicate unit code
    const existingCode = await unitRepository.findByCode(data.code);
    if (existingCode) {
      throw ApiError.conflict(`An active unit with code '${data.code}' already exists`);
    }

    // 3. Resolve & Validate Base Unit if provided
    let baseUnitDbId: bigint | null = null;
    if (data.baseUnitId) {
      const baseUnit = await unitRepository.findByUuid(data.baseUnitId);
      if (!baseUnit || !baseUnit.is_active) {
        throw ApiError.badRequest("Invalid or inactive base unit");
      }
      if (baseUnit.type !== data.type) {
        throw ApiError.badRequest(
          `Base unit type (${baseUnit.type}) must match unit type (${data.type})`
        );
      }
      baseUnitDbId = baseUnit.id;
    }

    const created = await unitRepository.create({
      uuid: crypto.randomUUID(),
      name: data.name,
      code: data.code,
      type: data.type as $Enums.product_units_type,
      base_unit_id: baseUnitDbId,
      conversion_factor: data.conversionFactor ?? 1,
      sort_order: data.sortOrder ?? 0,
      status: true, // Static reserved field - always true
      is_active: true, // Active status
      created_by: adminId,
      updated_by: adminId,
    });

    return formatAdminUnitResponse(created);
  },

  async getAdminUnits(params: GetAdminUnitsParams = {}) {
    const result = await unitRepository.findAdminAll(params);
    return {
      data: result.data.map((item) => formatAdminUnitResponse(item)),
      meta: result.meta,
    };
  },

  async getAdminUnitByUuid(uuid: string): Promise<AdminUnitResponse> {
    const unit = await unitRepository.findByUuid(uuid);
    if (!unit) {
      throw ApiError.notFound("Unit not found");
    }
    return formatAdminUnitResponse(unit);
  },

  async updateAdminUnit(
    uuid: string,
    data: UpdateAdminUnitInput,
    adminEmail?: string
  ): Promise<AdminUnitResponse> {
    const existing = await unitRepository.findByUuid(uuid);
    if (!existing) {
      throw ApiError.notFound("Unit not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updateData: Prisma.product_unitsUncheckedUpdateInput = {};

    if (adminId) {
      updateData.updated_by = adminId;
    }

    const targetType = (data.type ?? existing.type) as UnitType;

    // Check duplicate name if name changes
    if (data.name !== undefined && data.name !== existing.name) {
      const nameConflict = await unitRepository.findByName(data.name, uuid);
      if (nameConflict) {
        throw ApiError.conflict(`An active unit with name '${data.name}' already exists`);
      }
      updateData.name = data.name;
    }

    // Check duplicate code if code changes
    if (data.code !== undefined && data.code !== existing.code) {
      const codeConflict = await unitRepository.findByCode(data.code, uuid);
      if (codeConflict) {
        throw ApiError.conflict(`An active unit with code '${data.code}' already exists`);
      }
      updateData.code = data.code;
    }

    if (data.type !== undefined) {
      updateData.type = data.type as $Enums.product_units_type;
    }

    // Resolve & Validate Base Unit if baseUnitId is updated/provided
    if (data.baseUnitId !== undefined) {
      if (data.baseUnitId === null || data.baseUnitId === "") {
        updateData.base_unit_id = null;
      } else {
        if (data.baseUnitId === uuid) {
          throw ApiError.badRequest("A unit cannot be its own base unit");
        }
        const baseUnit = await unitRepository.findByUuid(data.baseUnitId);
        if (!baseUnit || !baseUnit.is_active) {
          throw ApiError.badRequest("Invalid or inactive base unit");
        }
        if (baseUnit.type !== targetType) {
          throw ApiError.badRequest(
            `Base unit type (${baseUnit.type}) must match unit type (${targetType})`
          );
        }
        updateData.base_unit_id = baseUnit.id;
      }
    } else if (data.type !== undefined && existing.base_unit_id) {
      // If type changed and existing has a base unit, check type match
      const baseUnit = await unitRepository.findById(existing.base_unit_id);
      if (baseUnit && baseUnit.type !== data.type) {
        throw ApiError.badRequest(
          `Base unit type (${baseUnit.type}) must match new unit type (${data.type})`
        );
      }
    }

    if (data.conversionFactor !== undefined) {
      updateData.conversion_factor = data.conversionFactor;
    }

    if (data.sortOrder !== undefined) {
      updateData.sort_order = data.sortOrder;
    }

    const updated = await unitRepository.updateByUuid(uuid, updateData);
    if (!updated) {
      throw ApiError.notFound("Unit not found");
    }

    return formatAdminUnitResponse(updated);
  },

  async deleteAdminUnit(uuid: string, adminEmail?: string) {
    const existing = await unitRepository.findByUuid(uuid);
    if (!existing) {
      throw ApiError.notFound("Unit not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    await unitRepository.softDeleteByUuid(uuid, adminId);

    return {
      success: true,
      message: "Unit deleted successfully",
    };
  },
};
