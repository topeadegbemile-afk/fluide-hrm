import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { prisma } from "../config/database.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    if (!authorization.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Invalid authorization format",
        error: "INVALID_AUTHORIZATION",
      });
      return;
    }

    const token = authorization.substring(7);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access token is required",
        error: "ACCESS_TOKEN_REQUIRED",
      });
      return;
    }

    const payload = verifyAccessToken(token);

    if (payload.deviceId) {
      const device = await prisma.securityDevice.findUnique({ where: { id: payload.deviceId }, select: { userId: true, revokedAt: true } });
      if (!device || device.userId !== payload.userId || device.revokedAt) {
        res.status(401).json({ success: false, message: "This device session has been revoked", error: "DEVICE_REVOKED" });
        return;
      }
    }

    req.user = {
      id: payload.userId,
      email: payload.email,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
      error: "INVALID_ACCESS_TOKEN",
    });
  }
}
