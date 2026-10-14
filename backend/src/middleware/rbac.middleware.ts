import { Response, NextFunction } from "express";
import { prisma } from "../config/database.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";

/**
 * Require one or more roles.
 *
 * Example:
 *
 * requireRole("SUPER_ADMIN")
 *
 * or:
 *
 * requireRole("SUPER_ADMIN", "HR")
 */
export function requireRole(...requiredRoles: string[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "AUTHENTICATION_REQUIRED",
        });
        return;
      }

      const userRoles = await prisma.userRole.findMany({
        where: {
          userId: req.user.id,
        },
        include: {
          role: true,
        },
      });

      const roles = userRoles.map(
        (userRole) => userRole.role.name
      );

      const hasRequiredRole = requiredRoles.some(
        (requiredRole) => roles.includes(requiredRole)
      );

      if (!hasRequiredRole) {
        res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action",
          error: "INSUFFICIENT_ROLE",
        });
        return;
      }

      next();
    } catch {
      res.status(500).json({
        success: false,
        message: "Unable to verify user role",
        error: "ROLE_CHECK_FAILED",
      });
    }
  };
}

/**
 * Require a specific permission.
 *
 * Example:
 *
 * requirePermission("employee:create")
 */
export function requirePermission(
  requiredPermission: string
) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "AUTHENTICATION_REQUIRED",
        });
        return;
      }

      const userRoles = await prisma.userRole.findMany({
        where: {
          userId: req.user.id,
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (userRoles.some((userRole) => userRole.role.name === "SUPER_ADMIN")) {
        next();
        return;
      }

      const permissions = [
        ...new Set(
          userRoles.flatMap((userRole) =>
            userRole.role.rolePermissions.map(
              (rolePermission) =>
                rolePermission.permission.name
            )
          )
        ),
      ];

      if (!permissions.includes(requiredPermission)) {
        res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action",
          error: "INSUFFICIENT_PERMISSION",
        });
        return;
      }

      next();
    } catch {
      res.status(500).json({
        success: false,
        message: "Unable to verify user permission",
        error: "PERMISSION_CHECK_FAILED",
      });
    }
  };
}
