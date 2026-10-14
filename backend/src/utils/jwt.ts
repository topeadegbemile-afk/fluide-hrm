import jwt from "jsonwebtoken";

function getRequiredSecret(name: string): jwt.Secret {
  const secret = process.env[name];
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error(`${name} is not defined`);
  }
  return secret;
}

const accessSecret = getRequiredSecret("JWT_ACCESS_SECRET");
const refreshSecret = getRequiredSecret("JWT_REFRESH_SECRET");

export interface AccessTokenPayload {
  userId: string;
  email: string;
  deviceId?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  deviceId?: string;
}

export function generateAccessToken(
  payload: AccessTokenPayload
): string {
  return jwt.sign(payload, accessSecret, {
    expiresIn: "15m",
  });
}

export function generateRefreshToken(
  payload: RefreshTokenPayload
): string {
  return jwt.sign(payload, refreshSecret, {
    expiresIn: "7d",
  });
}

export function verifyAccessToken(
  token: string
): AccessTokenPayload {
  const payload = jwt.verify(token, accessSecret);
  if (
    typeof payload !== "object" ||
    typeof payload.userId !== "string" ||
    typeof payload.email !== "string"
  ) {
    throw new Error("Invalid access token payload");
  }
  return { userId: payload.userId, email: payload.email, ...(typeof payload.deviceId === "string" ? { deviceId: payload.deviceId } : {}) };
}

export function verifyRefreshToken(
  token: string
): RefreshTokenPayload {
  const payload = jwt.verify(token, refreshSecret);
  if (typeof payload !== "object" || typeof payload.userId !== "string") {
    throw new Error("Invalid refresh token payload");
  }
  return { userId: payload.userId, ...(typeof payload.deviceId === "string" ? { deviceId: payload.deviceId } : {}) };
}
