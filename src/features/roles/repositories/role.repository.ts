import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";

const roleListInclude = Prisma.validator<Prisma.RoleInclude>()({
  _count: {
    select: {
      users: true,
      rolePermissions: true,
    },
  },
});

const roleDetailInclude = Prisma.validator<Prisma.RoleInclude>()({
  _count: {
    select: {
      users: true,
      rolePermissions: true,
    },
  },
  rolePermissions: {
    select: {
      permission: {
        select: {
          id: true,
          name: true,
          slug: true,
          module: true,
        },
      },
    },
  },
});

export const roleRepository = {
  async findAll(params: { page?: number; limit?: number; search?: string } = {}) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const where: Prisma.RoleWhereInput = params.search
      ? {
          OR: [
            { name: { contains: params.search } },
            { description: { contains: params.search } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      db.role.findMany({
        where,
        include: roleListInclude,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.role.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findById(id: number) {
    const role = await db.role.findUnique({
      where: { id },
      include: roleDetailInclude,
    });

    if (!role) return null;

    return {
      ...role,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    };
  },

  async findByName(name: string) {
    return db.role.findFirst({ where: { name } });
  },

  async create(data: { name: string; slug?: string; description?: string; permissionIds?: number[] }) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return db.role.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        rolePermissions: data.permissionIds?.length
          ? {
              create: data.permissionIds.map((permissionId) => ({
                permissionId,
              })),
            }
          : undefined,
      },
      include: roleDetailInclude,
    });
  },

  async update(
    id: number,
    data: { name?: string; description?: string; permissionIds?: number[] }
  ) {
    if (data.permissionIds !== undefined) {
      await db.rolePermission.deleteMany({ where: { roleId: id } });
    }

    return db.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        ...(data.permissionIds !== undefined
          ? {
              rolePermissions: {
                create: data.permissionIds.map((permissionId) => ({
                  permissionId,
                })),
              },
            }
          : {}),
      },
      include: roleDetailInclude,
    });
  },

  async delete(id: number) {
    return db.role.delete({ where: { id } });
  },

  async hasUsers(id: number) {
    const count = await db.user.count({ where: { roleId: id } });
    return count > 0;
  },
};

const permissionListInclude = Prisma.validator<Prisma.PermissionInclude>()({
  rolePermissions: {
    include: {
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
});

function formatPermission(p: any) {
  return {
    id: Number(p.id),
    name: p.name,
    slug: p.slug,
    module: p.module,
    description: p.description ?? null,
    roleIds: p.rolePermissions?.map((rp: any) => Number(rp.role.id)) ?? [],
    roles: p.rolePermissions?.map((rp: any) => ({ id: Number(rp.role.id), name: rp.role.name })) ?? [],
  };
}

export const permissionRepository = {
  async findAll() {
    const list = await db.permission.findMany({
      include: permissionListInclude,
      orderBy: [{ module: "asc" }, { name: "asc" }],
    });
    return list.map(formatPermission);
  },

  async findById(id: number) {
    const p = await db.permission.findUnique({
      where: { id },
      include: permissionListInclude,
    });
    return p ? formatPermission(p) : null;
  },

  async findByName(name: string) {
    const p = await db.permission.findFirst({
      where: { name },
      include: permissionListInclude,
    });
    return p ? formatPermission(p) : null;
  },

  async create(data: { name: string; slug?: string; description?: string; module: string; roleIds?: number[] }) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const created = await db.permission.create({
      data: {
        name: data.name,
        slug,
        module: data.module,
        rolePermissions: data.roleIds?.length
          ? {
              create: data.roleIds.map((roleId) => ({
                roleId: BigInt(roleId),
              })),
            }
          : undefined,
      },
      include: permissionListInclude,
    });
    return formatPermission(created);
  },

  async update(
    id: number,
    data: { name?: string; slug?: string; description?: string; module?: string; roleIds?: number[] }
  ) {
    if (data.roleIds !== undefined) {
      await db.rolePermission.deleteMany({ where: { permissionId: BigInt(id) } });
    }

    const updated = await db.permission.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        module: data.module,
        ...(data.roleIds !== undefined
          ? {
              rolePermissions: {
                create: data.roleIds.map((roleId) => ({
                  roleId: BigInt(roleId),
                })),
              },
            }
          : {}),
      },
      include: permissionListInclude,
    });
    return formatPermission(updated);
  },

  async delete(id: number) {
    return db.permission.delete({ where: { id } });
  },

  async hasRoles(id: number) {
    const count = await db.rolePermission.count({ where: { permissionId: id } });
    return count > 0;
  },
};
