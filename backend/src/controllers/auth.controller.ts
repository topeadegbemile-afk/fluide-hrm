import { Request, Response } from "express";

import {
  loginUser,
  refreshAccessToken,
  logoutUser,
} from "../services/auth.service.js";
import { setInitialPassword } from "../services/user.service.js";

import { prisma } from "../config/database.js";

import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

const DEVICE_COOKIE = "fluide_device";
function readDeviceCookie(req: Request) {
  const cookieHeader = req.headers.cookie ?? "";
  const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${DEVICE_COOKIE}=`));
  if (!match) return undefined;
  try { return decodeURIComponent(match.slice(DEVICE_COOKIE.length + 1)); } catch { return undefined; }
}
function setDeviceCookie(res: Response, credential: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${DEVICE_COOKIE}=${encodeURIComponent(credential)}; Path=/api/v1/auth; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`);
}
function clearDeviceCookie(res: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${DEVICE_COOKIE}=; Path=/api/v1/auth; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
}

export async function setPassword(req: Request, res: Response): Promise<void> {
  try {
    await setInitialPassword(req.body.token, req.body.password);
    res.status(200).json({ success: true, message: "Password set successfully. You can now sign in.", data: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to set password";
    const statusCode = message.includes("invalid or has expired") ? 400 : 500;
    res.status(statusCode).json({ success: false, message, error: statusCode === 400 ? "INVALID_SETUP_LINK" : "PASSWORD_SETUP_FAILED" });
  }
}

/**
 * POST /api/v1/auth/login
 */
export async function login(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email, password } = req.body;

    const result = await loginUser(email, password, readDeviceCookie(req), { userAgent: req.get("user-agent"), ipAddress: req.ip });
    setDeviceCookie(res, result.deviceCredential);
    const { deviceCredential: _deviceCredential, ...publicResult } = result;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: publicResult,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to login";

    if (message === "DEVICE_REVOKED") clearDeviceCookie(res);

    const statusCode =
      message === "Invalid email or password"
        ? 401
        : message === "Your account is not active"
          ? 403
          : message === "TWO_DEVICE_LIMIT_REACHED" || message === "DEVICE_REVOKED"
            ? 403
            : 500;

    res.status(statusCode).json({
      success: false,
      message,
      error: message === "TWO_DEVICE_LIMIT_REACHED" ? "DEVICE_LIMIT_REACHED" : message === "DEVICE_REVOKED" ? "DEVICE_REVOKED" : statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "AUTHENTICATION_ERROR",
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

    const result = await refreshAccessToken(refreshToken, readDeviceCookie(req), { userAgent: req.get("user-agent"), ipAddress: req.ip });
    if (result.deviceCredential) setDeviceCookie(res, result.deviceCredential);
    const { deviceCredential: _deviceCredential, ...publicResult } = result;

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: publicResult,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to refresh token";

    if (message === "DEVICE_REVOKED") clearDeviceCookie(res);
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
