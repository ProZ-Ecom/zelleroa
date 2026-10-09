import { z } from "zod";

export const getRolesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
});

export type GetRolesQueryInput = z.infer<typeof getRolesQuerySchema>;

export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required").max(255),
  description: z.string().max(1000).optional(),
  permissionIds: z.array(z.number().int().positive()).optional(),
});

export type CreateRoleSchemaInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = createRoleSchema.partial();

export type UpdateRoleSchemaInput = z.infer<typeof updateRoleSchema>;

export const createPermissionSchema = z.object({
  name: z.string().min(1, "Permission name is required").max(255),
  description: z.string().max(1000).optional(),
  module: z.string().min(1, "Module is required").max(255),
});

export type CreatePermissionSchemaInput = z.infer<typeof createPermissionSchema>;

export const updatePermissionSchema = createPermissionSchema.partial();

export type UpdatePermissionSchemaInput = z.infer<typeof updatePermissionSchema>;
