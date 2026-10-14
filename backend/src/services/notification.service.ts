import { prisma } from "../config/database.js";
import type { CreateNotificationInput, UpdateNotificationInput } from "../validators/notification.validator.js";

export async function getNotificationsForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, employee: { select: { id: true } } },
  });

  let employee = user?.employee ?? null;
  if (user && !employee) {
    const matchingEmployee = await prisma.employee.findFirst({
      where: { email: user.email, userId: null },
      select: { id: true },
    });
    if (matchingEmployee) {
      const linked = await prisma.employee.updateMany({
        where: { id: matchingEmployee.id, userId: null },
        data: { userId },
      });
      if (linked.count === 1) employee = matchingEmployee;
      else employee = await prisma.employee.findUnique({ where: { userId }, select: { id: true } });
    }
  }

  return prisma.notification.findMany({
    where: {
      OR: [
        { userId },
        ...(employee ? [{ employeeId: employee.id }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getNotificationsForEmployee(employeeId: string) {
  return prisma.notification.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNotification(data: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: data.userId ?? null,
      employeeId: data.employeeId ?? null,
      title: data.title,
      message: data.message,
      type: data.type ?? "INFO",
      metadata: data.metadata ?? undefined,
    },
  });
}

export async function createNotificationForAllEmployees(data: CreateNotificationInput) {
  const employees = await prisma.employee.findMany({
    where: { userId: { not: null } },
    select: { id: true },
  });
  if (!employees.length) return { count: 0 };
  const result = await prisma.notification.createMany({
    data: employees.map(({ id }) => ({
      employeeId: id,
      title: data.title,
      message: data.message,
      type: data.type ?? "ANNOUNCEMENT",
      metadata: data.metadata ?? undefined,
    })),
  });
  return { count: result.count };
}

export async function updateNotification(id: string, data: UpdateNotificationInput) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) {
    throw new Error("Notification not found");
  }

  return prisma.notification.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.message !== undefined && { message: data.message }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.isRead !== undefined && { isRead: data.isRead }),
      ...(data.metadata !== undefined && { metadata: data.metadata }),
    },
  });
}

async function assertNotificationOwnership(id: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { employee: { select: { id: true } } },
  });
  if (!user) {
    throw new Error("User not found");
  }

  const notification = await prisma.notification.findFirst({
    where: {
      id,
      OR: [
        { userId },
        ...(user.employee ? [{ employeeId: user.employee.id }] : []),
      ],
    },
  });
  if (!notification) {
    throw new Error("Notification not found");
  }

  return notification;
}

export async function updateNotificationForUser(
  id: string,
  userId: string,
  data: UpdateNotificationInput
) {
  await assertNotificationOwnership(id, userId);
  return updateNotification(id, data);
}

export async function deleteNotification(id: string, userId: string) {
  await assertNotificationOwnership(id, userId);
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) {
    throw new Error("Notification not found");
  }

  await prisma.notification.delete({ where: { id } });
  return { id, deleted: true };
}
