import { prisma } from "../config/database.js";
import type { CreateRoleInput, UpdateRoleInput } from "../validators/role.validator.js";

export async function getRoles() {
  return prisma.role.findMany({
    orderBy: { name: "asc" },
    include: {
      rolePermissions: { include: { permission: true } },
      userRoles: true,
    },
  });
}

export async function getRoleById(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      rolePermissions: { include: { permission: true } },
      userRoles: true,
    },
  });

  if (!role) {
    throw new Error("Role not found");
  }

  return role;
}

export async function createRole(data: CreateRoleInput) {
  const existing = await prisma.role.findUnique({ where: { name: data.name.trim() } });
  if (existing) {
    throw new Error("A role with this name already exists");
  }

  const role = await prisma.role.create({
    data: {
      name: data.name.trim(),
      description: data.description,
      rolePermissions: data.permissionIds.length
        ? {
            create: data.permissionIds.map((permissionId) => ({ permission: { connect: { id: permissionId } } })),
          }
        : undefined,
    },
    include: {
      rolePermissions: { include: { permission: true } },
    },
  });

  return role;
}

export async function updateRole(id: string, data: UpdateRoleInput) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    throw new Error("Role not found");
  }

  if (data.name && data.name.trim() !== role.name) {
    const existing = await prisma.role.findUnique({ where: { name: data.name.trim() } });
    if (existing) {
      throw new Error("A role with this name already exists");
    }
  }

  return prisma.role.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.permissionIds !== undefined && {
        rolePermissions: {
          deleteMany: {},
          create: data.permissionIds.map((permissionId) => ({
            permission: { connect: { id: permissionId } },
          })),
        },
      }),
    },
    include: {
      rolePermissions: { include: { permission: true } },
    },
  });
}

export async function getPermissions() {
  return prisma.permission.findMany({
    orderBy: { name: "asc" },
  });
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    throw new Error("Role not found");
  }

  await prisma.role.delete({ where: { id } });
  return { id, deleted: true };
}

export async function assignPermissionToRole(roleId: string, permissionId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new Error("Role not found");
  }

  const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) {
    throw new Error("Permission not found");
  }

  return prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId,
        permissionId,
      },
    },
    update: {},
    create: { roleId, permissionId },
    include: { permission: true },
  });
}
