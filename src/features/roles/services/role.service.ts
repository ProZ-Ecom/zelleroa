import { ApiError } from "@/lib/api/api-error";
import { roleRepository, permissionRepository } from "../repositories/role.repository";
import type { CreateRoleInput, UpdateRoleInput, CreatePermissionInput, UpdatePermissionInput } from "../types";

export const roleService = {
  async getRoles(params: { page?: number; limit?: number; search?: string } = {}) {
    return roleRepository.findAll(params);
  },

  async getRole(id: number) {
    const role = await roleRepository.findById(id);
    if (!role) {
      throw ApiError.notFound("Role not found");
    }
    return role;
  },

  async createRole(data: CreateRoleInput) {
    const existing = await roleRepository.findByName(data.name);
    if (existing) {
      throw ApiError.conflict("A role with this name already exists");
    }

    return roleRepository.create(data);
  },

  async updateRole(id: number, data: UpdateRoleInput) {
    const existing = await roleRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("Role not found");
    }

    if (data.name && data.name !== existing.name) {
      const nameExists = await roleRepository.findByName(data.name);
      if (nameExists) {
        throw ApiError.conflict("A role with this name already exists");
      }
    }

    return roleRepository.update(id, data);
  },

  async deleteRole(id: number) {
    const existing = await roleRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("Role not found");
    }

    const hasUsers = await roleRepository.hasUsers(id);
    if (hasUsers) {
      throw ApiError.badRequest(
        "Cannot delete role with existing users. Reassign users first."
      );
    }

    return roleRepository.delete(id);
  },
};

export const permissionService = {
  async getPermissions() {
    return permissionRepository.findAll();
  },

  async getPermission(id: number) {
    const permission = await permissionRepository.findById(id);
    if (!permission) {
      throw ApiError.notFound("Permission not found");
    }
    return permission;
  },

  async createPermission(data: CreatePermissionInput) {
    const existing = await permissionRepository.findByName(data.name);
    if (existing) {
      throw ApiError.conflict("A permission with this name already exists");
    }

    return permissionRepository.create(data);
  },

  async updatePermission(id: number, data: UpdatePermissionInput) {
    const existing = await permissionRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("Permission not found");
    }

    if (data.name && data.name !== existing.name) {
      const nameExists = await permissionRepository.findByName(data.name);
      if (nameExists) {
        throw ApiError.conflict("A permission with this name already exists");
      }
    }

    return permissionRepository.update(id, data);
  },

  async deletePermission(id: number) {
    const existing = await permissionRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("Permission not found");
    }

    const hasRoles = await permissionRepository.hasRoles(id);
    if (hasRoles) {
      throw ApiError.badRequest(
        "Cannot delete permission assigned to roles. Remove from roles first."
      );
    }

    return permissionRepository.delete(id);
  },
};
