import { Request, Response } from "express";

import {
  loginUser,
  refreshAccessToken,
  logoutUser,
} from "../services/auth.service.js";

import { prisma } from "../config/database.js";

import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

/**
 * POST /api/v1/auth/login
 */
export async function login(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email, password } = req.body;

    const result = await loginUser(
      email,
      password
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to login";

    const statusCode =
      message === "Invalid email or password"
        ? 401
        : message === "Your account is not active"
          ? 403
          : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error:
        statusCode === 500
          ? "INTERNAL_SERVER_ERROR"
          : "AUTHENTICATION_ERROR",
    });
  }
}

/**
 * POST /api/v1/auth/refresh
 */
export async function refresh(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { refreshToken } = req.body;

    const result =
      await refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to refresh token";

    res.status(401).json({
      success: false,
      message,
      error: "INVALID_REFRESH_TOKEN",
    });
  }
}

/**
 * POST /api/v1/auth/logout
 */
export async function logout(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { refreshToken } = req.body;

    await logoutUser(refreshToken);

    res.status(200).json({
      success: true,
      message: "Logout successful",
      data: null,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to logout",
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}

/**
 * GET /api/v1/auth/me
 */
export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },

      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            phone: true,
            profilePhoto: true,
            employmentStatus: true,
            dateJoined: true,
            department: { select: { id: true, name: true } },
            position: { select: { id: true, title: true } },
          },
        },
        userRoles: {
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
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
        error: "USER_NOT_FOUND",
      });
      return;
    }

    const roles = user.userRoles.map(
      (userRole) => userRole.role.name
    );

    const permissions = [
      ...new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map(
            (rolePermission) =>
              rolePermission.permission.name
          )
        )
      ),
    ];

    res.status(200).json({
      success: true,
      message: "Current user retrieved successfully",
      data: {
        id: user.id,
        email: user.email,
        status: user.status,
        employee: user.employee,
        roles,
        permissions,
      },
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to retrieve current user",
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}