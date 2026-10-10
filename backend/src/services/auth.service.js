import { createHash } from "node:crypto";
import { prisma } from "../config/database.js";
import { comparePassword } from "../utils/password.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, } from "../utils/jwt.js";
const REFRESH_TOKEN_DAYS = 7;
/**
 * Hash a refresh token before storing it in the database.
 * We never store the actual refresh token in PostgreSQL.
 */
function hashRefreshToken(token) {
    return createHash("sha256")
        .update(token)
        .digest("hex");
}
/**
 * LOGIN
 *
 * Verifies the user's email and password,
 * loads their roles and permissions,
 * then generates access and refresh tokens.
 */
export async function loginUser(email, password) {
    const normalizedEmail = email
        .trim()
        .toLowerCase();
    const user = await prisma.user.findUnique({
        where: {
            email: normalizedEmail,
        },
        include: {
            employee: true,
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
        throw new Error("Invalid email or password");
    }
    // User account is not active
    if (user.status !== "ACTIVE") {
        throw new Error("Your account is not active");
    }

  // User must complete initial password setup before signing in
  if (user.setupTokenHash) {
    throw new Error(
      "Please use your account setup link to set your password before signing in"
    );
  }

    // Check password
    const passwordValid = await comparePassword(password, user.passwordHash);
    if (!passwordValid) {
        throw new Error("Invalid email or password");
    }
    // Get user's roles
    const roles = user.userRoles.map((userRole) => userRole.role.name);
    // Get user's permissions
    const permissions = [
        ...new Set(user.userRoles.flatMap((userRole) => userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.name))),
    ];
    // Generate short-lived access token
    const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
    });
    // Generate long-lived refresh token
    const refreshToken = generateRefreshToken({
        userId: user.id,
    });
    // Hash refresh token before storing it
    const refreshTokenHash = hashRefreshToken(refreshToken);
    // Refresh token expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
    // Store refresh token hash
    await prisma.refreshToken.create({
        data: {
            tokenHash: refreshTokenHash,
            userId: user.id,
            expiresAt,
        },
    });
    // Return authentication result
    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            status: user.status,
            employee: user.employee
                ? {
                    id: user.employee.id,
                    employeeNumber: user.employee.employeeNumber,
                    firstName: user.employee.firstName,
                    lastName: user.employee.lastName,
                    email: user.employee.email,
                    profilePhoto: user.employee.profilePhoto,
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
export async function refreshAccessToken(refreshToken) {
    // Verify JWT signature and payload
    const payload = verifyRefreshToken(refreshToken);
    // Hash the provided token
    const tokenHash = hashRefreshToken(refreshToken);
    // Find token in database
    const storedToken = await prisma.refreshToken.findUnique({
        where: {
            tokenHash,
        },
    });
    // Token does not exist
    if (!storedToken) {
        throw new Error("Invalid refresh token");
    }
    // Token was already revoked
    if (storedToken.revokedAt) {
        throw new Error("Refresh token has been revoked");
    }
    // Token has expired
    if (storedToken.expiresAt <= new Date()) {
        throw new Error("Refresh token has expired");
    }
    // Make sure token belongs to the same user
    if (storedToken.userId !== payload.userId) {
        throw new Error("Invalid refresh token");
    }
    // Find user
    const user = await prisma.user.findUnique({
        where: {
            id: payload.userId,
        },
    });
    if (!user) {
        throw new Error("User not found");
    }
    // Make sure user is still active
    if (user.status !== "ACTIVE") {
        throw new Error("Your account is not active");
    }
    // Revoke the old refresh token.
    // This prevents it from being reused.
    await prisma.refreshToken.update({
        where: {
            id: storedToken.id,
        },
        data: {
            revokedAt: new Date(),
        },
    });
    // Generate new access token
    const newAccessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
    });
    // Generate new refresh token
    const newRefreshToken = generateRefreshToken({
        userId: user.id,
    });
    // Hash new refresh token
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
    // Calculate new expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
    // Store new refresh token
    await prisma.refreshToken.create({
        data: {
            tokenHash: newRefreshTokenHash,
            userId: user.id,
            expiresAt,
        },
    });
    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
    };
}
/**
 * LOGOUT
 *
 * Revokes the refresh token so it can no longer
 * be used to obtain new access tokens.
 */
export async function logoutUser(refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
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
