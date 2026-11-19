import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ApiError } from "@/lib/api/api-error";
import { staffRepository } from "../repositories/staff.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import type { Prisma } from "@/generated/prisma";
import type {
  StaffResponse,
  GetStaffParams,
  AdminStaffCountResponse,
} from "../types";
import type {
  CreateStaffInput,
  UpdateStaffInput,
  UpdateStaffProfileInput,
  ChangeStaffPasswordInput,
} from "../validations/staff.schema";

function formatStaffResponse(user: {
  id: bigint;
  uuid: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  status: string;
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
  role?: { id: bigint; name: string; slug: string; scope?: string } | null;
}): StaffResponse {
  return {
    id: user.uuid || String(user.id),
    name: user.name,
    email: user.email || "",
    phone: user.phone ?? null,
    avatar: user.avatar ?? null,
    role: user.role?.name || "STAFF",
    roleId: user.role ? Number(user.role.id) : null,
    status: user.status,
    isActive: Boolean(user.is_active),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * The role a staff member goes into. `roleId` is whatever the admin picked on the Staff
 * screen and must be a back-office role (scope ADMIN, not an owner role); with no pick we
 * fall back to the built-in STAFF role.
 */
async function resolveStaffRole(roleId?: number) {
  if (roleId !== undefined) {
    const role = await staffRepository.findAssignableStaffRole(roleId);
    if (!role) {
      throw ApiError.badRequest(
        "Select an active admin-panel role. Create one under Roles if you need a new one."
      );
    }
    return role;
  }

  const staffRole = await staffRepository.getStaffRole();
  if (!staffRole) {
    throw ApiError.internal("Staff role is not configured in the system");
  }
  return staffRole;
}

async function getAdminInternalId(email?: string | null): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

export const staffService = {
  async createStaff(
    input: CreateStaffInput,
    adminEmail?: string | null
  ): Promise<StaffResponse> {
    const adminId = await getAdminInternalId(adminEmail);

    // 1. Resolve the role: the one the admin picked, else the built-in STAFF role.
    const staffRole = await resolveStaffRole(input.roleId);

    // 2. Check duplicate email
    const existingEmail = await staffRepository.findByEmail(input.email);
    if (existingEmail) {
      throw ApiError.conflict("An account with this email address already exists");
    }

    // 3. Check duplicate phone if provided
    if (input.phone) {
      const existingPhone = await staffRepository.findByPhone(input.phone);
      if (existingPhone) {
        throw ApiError.conflict("An account with this phone number already exists");
      }
    }

    // 4. Secure password hash
    const hashedPassword = await bcrypt.hash(input.password, 12);

    // 5. Create the staff user in the resolved back-office role
    const created = await staffRepository.createStaff({
      uuid: crypto.randomUUID(),
      name: input.name,
      email: input.email.toLowerCase().trim(),
      phone: input.phone?.trim() || null,
      password_hash: hashedPassword,
      roleId: staffRole.id,
      status: "active",
      is_active: input.isActive ?? true,
      created_by: adminId,
      updated_by: adminId,
    });

    return formatStaffResponse(created);
  },

  /** Roles the Staff screen may assign (every active ADMIN-scope role bar the owners). */
  async getAssignableRoles() {
    const roles = await staffRepository.findAssignableStaffRoles();
    return roles.map((role) => ({
      id: Number(role.id),
      name: role.name,
      slug: role.slug,
      description: role.description,
    }));
  },

  async getStaffList(params: GetStaffParams = {}) {
    const result = await staffRepository.findStaffList(params);
    const data = result.data.map(formatStaffResponse);

    return {
      data,
      meta: result.meta,
    };
  },

  async countStaff(
    params: GetStaffParams = {}
  ): Promise<AdminStaffCountResponse> {
    return staffRepository.countStaff(params);
  },

  async getStaffByUuid(uuid: string): Promise<StaffResponse> {
    const staff = await staffRepository.findStaffByUuid(uuid);
    if (!staff) {
      throw ApiError.notFound("Staff member not found");
    }
    return formatStaffResponse(staff);
  },

  async updateStaff(
    uuid: string,
    input: UpdateStaffInput,
    adminEmail?: string | null
  ): Promise<StaffResponse> {
    const existing = await staffRepository.findStaffByUuid(uuid);
    if (!existing) {
      throw ApiError.notFound("Staff member not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updateData: Prisma.UserUncheckedUpdateInput = {};

    if (adminId) {
      updateData.updated_by = adminId;
    }

    // Check duplicate email if changed
    if (input.email !== undefined && input.email.toLowerCase() !== existing.email?.toLowerCase()) {
      const emailConflict = await staffRepository.findByEmail(input.email, uuid);
      if (emailConflict) {
        throw ApiError.conflict("An account with this email address already exists");
      }
      updateData.email = input.email.toLowerCase().trim();
    }

    // Check duplicate phone if changed
    if (input.phone !== undefined && input.phone !== existing.phone) {
      if (input.phone) {
        const phoneConflict = await staffRepository.findByPhone(input.phone, uuid);
        if (phoneConflict) {
          throw ApiError.conflict("An account with this phone number already exists");
        }
        updateData.phone = input.phone.trim();
      } else {
        updateData.phone = null;
      }
    }

    if (input.name !== undefined) {
      updateData.name = input.name.trim();
    }

    if (input.isActive !== undefined) {
      updateData.is_active = input.isActive;
    }

    if (input.password !== undefined) {
      updateData.password_hash = await bcrypt.hash(input.password, 12);
    }

    if (input.roleId !== undefined) {
      updateData.roleId = (await resolveStaffRole(input.roleId)).id;
    }

    const updated = await staffRepository.updateStaffByUuid(uuid, updateData);
    if (!updated) {
      throw ApiError.notFound("Staff member not found");
    }

    return formatStaffResponse(updated);
  },

  async getStaffProfile(sessionUserId: string): Promise<StaffResponse> {
    const staff = await staffRepository.findStaffByUuid(sessionUserId);
    if (!staff) {
      throw ApiError.notFound("Staff profile not found");
    }
    return formatStaffResponse(staff);
  },

  async updateStaffProfile(
    sessionUserId: string,
    input: UpdateStaffProfileInput
  ): Promise<StaffResponse> {
    const existing = await staffRepository.findStaffByUuid(sessionUserId);
    if (!existing) {
      throw ApiError.notFound("Staff profile not found");
    }

    const updateData: Prisma.UserUncheckedUpdateInput = {
      updated_by: existing.id,
    };

    // Check duplicate email if changed
    if (
      input.email !== undefined &&
      input.email.toLowerCase() !== existing.email?.toLowerCase()
    ) {
      const emailConflict = await staffRepository.findByEmail(
        input.email,
        existing.uuid || undefined
      );
      if (emailConflict) {
        throw ApiError.conflict("An account with this email address already exists");
      }
      updateData.email = input.email.toLowerCase().trim();
    }

    // Check duplicate phone if changed
    if (input.phone !== undefined && input.phone !== existing.phone) {
      if (input.phone) {
        const phoneConflict = await staffRepository.findByPhone(
          input.phone,
          existing.uuid || undefined
        );
        if (phoneConflict) {
          throw ApiError.conflict("An account with this phone number already exists");
        }
        updateData.phone = input.phone.trim();
      } else {
        updateData.phone = null;
      }
    }

    if (input.name !== undefined) {
      updateData.name = input.name.trim();
    }

    if (input.avatar !== undefined) {
      updateData.avatar = input.avatar ? input.avatar.trim() : null;
    }

    const updated = await staffRepository.updateStaffByUuid(
      existing.uuid!,
      updateData
    );
    if (!updated) {
      throw ApiError.notFound("Staff profile not found");
    }

    return formatStaffResponse(updated);
  },

  async changeStaffPassword(
    sessionUserId: string,
    input: ChangeStaffPasswordInput
  ): Promise<{ message: string }> {
    const existing = await staffRepository.findStaffByUuid(sessionUserId);
    if (!existing) {
      throw ApiError.notFound("Staff profile not found");
    }

    if (!existing.password_hash) {
      throw ApiError.badRequest("No password set for this account");
    }

    const isMatch = await bcrypt.compare(
      input.currentPassword,
      existing.password_hash
    );
    if (!isMatch) {
      throw ApiError.badRequest("Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    await staffRepository.updateStaffByUuid(existing.uuid!, {
      password_hash: hashedPassword,
      updated_by: existing.id,
    });

    return {
      message: "Password changed successfully",
    };
  },
};

