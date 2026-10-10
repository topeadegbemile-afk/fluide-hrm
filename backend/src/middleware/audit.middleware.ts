import type { NextFunction, Response } from "express";
import { prisma } from "../config/database.js";
import { createAuditLog } from "../services/audit.service.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";

export function auditSuccessfulMutation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  res.on("finish", () => {
    if (!req.user || res.statusCode >= 400 || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return;
    }

    const action =
      req.method === "POST"
        ? "CREATE"
        : req.method === "DELETE"
          ? "DELETE"
          : req.path.endsWith("/assign-role") || req.path.endsWith("/assign-permission")
            ? "ASSIGN"
            : "UPDATE";

    void (async () => {
      const actor = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          employee: { select: { id: true } },
        },
      });

      await createAuditLog({
        userId: actor?.id,
        actorId: actor?.employee?.id,
        entityType: req.baseUrl.split("/").filter(Boolean).at(-1) ?? "unknown",
        entityId: typeof req.params.id === "string" ? req.params.id : undefined,
        action,
        details: `${req.method} ${req.originalUrl} returned ${res.statusCode}`,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
    })().catch((error: unknown) => {
      console.error("Failed to persist audit log for request", error);
    });
  });

  next();
}
