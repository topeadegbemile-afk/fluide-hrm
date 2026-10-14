import { createHash, randomBytes } from "node:crypto";

import { prisma } from "../config/database.js";
import { comparePassword } from "../utils/password.js";
import { recordSecurityEvent } from "./security.service.js";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";

const REFRESH_TOKEN_DAYS = 7;

/**
 * Hash a refresh token before storing it in the database.
 * We never store the actual refresh token in PostgreSQL.
 */
function hashRefreshToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function hashDeviceCredential(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

async function registerOrValidateDevice(userId: string, presentedSecret: string | undefined, userAgent?: string, ipAddress?: string, issueSession = false) {
  let secret = !issueSession && presentedSecret && presentedSecret.length >= 32 ? presentedSecret : randomBytes(32).toString("base64url");
  let registration: { id: string; secret: string; created: boolean; accessToken?: string; refreshToken?: string };
  try {
    registration = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      if (issueSession) {
        const now = new Date();
        await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
        await tx.securityDevice.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      }
      let credentialHash = hashDeviceCredential(secret);
      let existing = await tx.securityDevice.findUnique({ where: { credentialHash } });
      if (existing && existing.userId !== userId) {
        secret = randomBytes(32).toString("base64url");
        credentialHash = hashDeviceCredential(secret);
        existing = await tx.securityDevice.findUnique({ where: { credentialHash } });
      }
      if (existing?.revokedAt) throw new Error("DEVICE_REVOKED");
      let deviceId: string;
      let created = false;
      if (existing) {
        await tx.securityDevice.update({ where: { id: existing.id }, data: { lastUsedAt: new Date(), lastIpAddress: ipAddress ?? null, userAgent: userAgent?.slice(0, 500) ?? null } });
        deviceId = existing.id;
      } else {
        const activeCount = await tx.securityDevice.count({ where: { userId, revokedAt: null } });
        if (activeCount >= 2) throw new Error("TWO_DEVICE_LIMIT_REACHED");
        const device = await tx.securityDevice.create({ data: { userId, credentialHash, label: userAgent?.slice(0, 120) ?? "Registered device", userAgent: userAgent?.slice(0, 500) ?? null, lastIpAddress: ipAddress ?? null } });
        deviceId = device.id;
        created = true;
      }
      const result: { id: string; secret: string; created: boolean; accessToken?: string; refreshToken?: string } = { id: deviceId, secret, created };
      if (issueSession) {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (!user) throw new Error("User not found");
        result.accessToken = generateAccessToken({ userId, email: user.email, deviceId });
        result.refreshToken = generateRefreshToken({ userId, deviceId });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
        await tx.refreshToken.create({ data: { tokenHash: hashRefreshToken(result.refreshToken), userId, deviceId, expiresAt } });
        await tx.securityEvent.create({ data: { userId, userEmail: user.email, eventType: "DEVICE_LOGIN", outcome: "ALLOWED", reason: created ? "DEVICE_REGISTERED" : "REGISTERED_DEVICE", ipAddress: ipAddress ?? null, details: { deviceId } } });
      }
      return result;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DEVICE_REGISTRATION_FAILED";
    if (message === "TWO_DEVICE_LIMIT_REACHED" || message === "DEVICE_REVOKED") {
      await recordSecurityEvent({ userId, eventType: "DEVICE_LOGIN", outcome: "DENIED", reason: message, ipAddress });
    }
    throw error;
  }
  return registration;
}

/**
 * LOGIN
 *
 * Verifies the user's email and password,
 * loads their roles and permissions,
 * then generates access and refresh tokens.
 */
export async function loginUser(
  email: string,
  password: string,
  deviceCredential?: string,
  context?: { userAgent?: string; ipAddress?: string },
) {
  const normalizedEmail = email
    .trim()
    .toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },

    include: {
      employee: {
        include: {
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

  // User does not exist
  if (!user) {
    await recordSecurityEvent({ eventType: "LOGIN", outcome: "DENIED", reason: "INVALID_CREDENTIALS", ipAddress: context?.ipAddress });
    throw new Error("Invalid email or password");
  }

  // User account is not active
  if (user.status !== "ACTIVE") {
    throw new Error("Your account is not active");
  }

  // Check password
  const passwordValid = await comparePassword(
    password,
    user.passwordHash
  );

  if (!passwordValid) {
    await recordSecurityEvent({ userId: user.id, eventType: "LOGIN", outcome: "DENIED", reason: "INVALID_CREDENTIALS", ipAddress: context?.ipAddress });
    throw new Error("Invalid email or password");
  }

  const device = await registerOrValidateDevice(user.id, deviceCredential, context?.userAgent, context?.ipAddress, true);

  // Get user's roles
  const roles = user.userRoles.map(
    (userRole) => userRole.role.name
  );

  // Get user's permissions
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

  // Generate short-lived access token
  // Return authentication result
  return {
    accessToken: device.accessToken!,
    refreshToken: device.refreshToken!,
    deviceCredential: device.secret,

    user: {
      id: user.id,
      email: user.email,
      status: user.status,

      employee: user.employee
        ? {
            id: user.employee.id,
            employeeNumber:
              user.employee.employeeNumber,
            firstName:
              user.employee.firstName,
            lastName:
              user.employee.lastName,
            middleName:
              user.employee.middleName,
            email: user.employee.email,
            phone: user.employee.phone,
            profilePhoto:
              user.employee.profilePhoto,
            employmentStatus:
              user.employee.employmentStatus,
            dateJoined:
              user.employee.dateJoined,
            department: user.employee.department,
            position: user.employee.position,
          }
        : null,

      roles,
      permissions,
    },
  };
}

/**
 * REFRESH ACCESS TOKEN
 *
 * Verifies the refresh token,
 * checks that it exists in the database,
 * checks expiration/revocation,
 * then rotates it and generates new tokens.
 */
export async function refreshAccessToken(refreshToken: string, deviceCredential?: string, context?: { userAgent?: string; ipAddress?: string }) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashRefreshToken(refreshToken);
  const storedToken = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date() || storedToken.userId !== payload.userId) {
    throw new Error("Invalid or expired refresh token");
  }
  if (payload.deviceId && storedToken.deviceId !== payload.deviceId) throw new Error("Invalid refresh token");

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) throw new Error("User not found");
  if (user.status !== "ACTIVE") throw new Error("Your account is not active");

  let deviceId = storedToken.deviceId;
  let credential = deviceCredential;
  if (deviceId) {
    const device = await prisma.securityDevice.findUnique({ where: { id: deviceId } });
    if (!device || device.revokedAt) throw new Error("DEVICE_REVOKED");
    if (!credential || hashDeviceCredential(credential) !== device.credentialHash) throw new Error("Registered device credential is missing or invalid");
    await prisma.securityDevice.update({ where: { id: deviceId }, data: { lastUsedAt: new Date(), lastIpAddress: context?.ipAddress ?? null } });
  } else {
    const registration = await registerOrValidateDevice(user.id, credential, context?.userAgent, context?.ipAddress);
    deviceId = registration.id;
    credential = registration.secret;
  }

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, deviceId });
  const nextRefreshToken = generateRefreshToken({ userId: user.id, deviceId });
  const nextTokenHash = hashRefreshToken(nextRefreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
  await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({ where: { id: storedToken.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (revoked.count !== 1) throw new Error("Refresh token has already been used");
    await tx.refreshToken.create({ data: { tokenHash: nextTokenHash, userId: user.id, deviceId, expiresAt } });
  });
  return { accessToken, refreshToken: nextRefreshToken, deviceCredential: credential };
}

/**
 * LOGOUT
 *
 * Revokes the refresh token so it can no longer
 * be used to obtain new access tokens.
 */
export async function logoutUser(
  refreshToken: string
) {
  const tokenHash =
    hashRefreshToken(refreshToken);

  const storedToken =
    await prisma.refreshToken.findUnique({
      where: {
        tokenHash,
      },
    });

  // If token doesn't exist, logout is already effectively complete.
  if (!storedToken) {
    return;
  }

  // Revoke the token if it hasn't already been revoked.
  if (!storedToken.revokedAt) {
    await prisma.refreshToken.update({
      where: {
        id: storedToken.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
