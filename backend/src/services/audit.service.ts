import { prisma } from "../config/database.js";

export async function getAuditLogs() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      actor: true,
      user: {
        select: {
          id: true,
          email: true,
          status: true,
        },
      },
    },
  });
}

export async function createAuditLog(data: {
  actorId?: string | null;
  userId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "APPROVE" | "REJECT" | "ASSIGN" | "EXPORT";
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: data.actorId ?? null,
      userId: data.userId ?? null,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      action: data.action,
      details: data.details ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
    },
  });
}
