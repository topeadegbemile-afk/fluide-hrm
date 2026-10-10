import { prisma } from "../config/database.js";
import type {
  CreateCelebrationInput,
  UpdateCelebrationInput,
} from "../validators/celebration.validator.js";

async function getEmployeeForUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true },
  });
}

async function getUserRoles(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });

  return user?.userRoles.map((userRole) => userRole.role.name) ?? [];
}

function hasRole(roles: string[], ...names: string[]) {
  return names.some((name) => roles.includes(name));
}

export async function createCelebration(userId: string, data: CreateCelebrationInput) {
  const roles = await getUserRoles(userId);
  if (!hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER")) {
    throw new Error("You do not have permission to create celebrations");
  }

  const employee = await getEmployeeForUser(userId);

  return prisma.celebration.create({
    data: {
      title: data.title,
      type: data.type ?? "OTHER",
      description: data.description ?? null,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      location: data.location ?? null,
      imageUrl: data.imageUrl ?? null,
      isPublished: data.isPublished ?? true,
      createdById: employee?.employee?.id ?? null,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function getCelebrations() {
  return prisma.celebration.findMany({
    orderBy: { eventDate: "desc" },
    include: {
      createdBy: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function getCelebrationById(id: string) {
  const celebration = await prisma.celebration.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!celebration) {
    throw new Error("Celebration not found");
  }

  return celebration;
}

export async function updateCelebration(userId: string, id: string, data: UpdateCelebrationInput) {
  const roles = await getUserRoles(userId);
  if (!hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER")) {
    throw new Error("You do not have permission to update celebrations");
  }

  const celebration = await prisma.celebration.findUnique({ where: { id } });
  if (!celebration) {
    throw new Error("Celebration not found");
  }

  return prisma.celebration.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.eventDate !== undefined && { eventDate: new Date(data.eventDate) }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
    },
    include: {
      createdBy: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function deleteCelebration(userId: string, id: string) {
  const roles = await getUserRoles(userId);
  if (!hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER")) {
    throw new Error("You do not have permission to delete celebrations");
  }

  const celebration = await prisma.celebration.findUnique({ where: { id } });
  if (!celebration) {
    throw new Error("Celebration not found");
  }

  await prisma.celebration.delete({ where: { id } });

  return { id, deleted: true };
}
