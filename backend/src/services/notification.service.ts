import { prisma } from "../config/database.js";
import type { CreateNotificationInput, UpdateNotificationInput } from "../validators/notification.validator.js";

export async function getNotificationsForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { employee: { select: { id: true } } },
  });

  return prisma.notification.findMany({
    where: {
      OR: [
        { userId },
        ...(user?.employee ? [{ employeeId: user.employee.id }] : []),
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
