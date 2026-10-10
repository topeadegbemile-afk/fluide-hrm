import jwt from "jsonwebtoken";
function getRequiredSecret(name) {
    const secret = process.env[name];
    if (typeof secret !== "string" || secret.length === 0) {
        throw new Error(`${name} is not defined`);
    }
    return secret;
}
const accessSecret = getRequiredSecret("JWT_ACCESS_SECRET");
const refreshSecret = getRequiredSecret("JWT_REFRESH_SECRET");
export function generateAccessToken(payload) {
    return jwt.sign(payload, accessSecret, {
        expiresIn: "15m",
    });
}
export function generateRefreshToken(payload) {
    return jwt.sign(payload, refreshSecret, {
        expiresIn: "7d",
    });
}
export function verifyAccessToken(token) {
    const payload = jwt.verify(token, accessSecret);
    if (typeof payload !== "object" ||
        typeof payload.userId !== "string" ||
        typeof payload.email !== "string") {
        throw new Error("Invalid access token payload");
    }
    return { userId: payload.userId, email: payload.email };
}
export function verifyRefreshToken(token) {
    const payload = jwt.verify(token, refreshSecret);
    if (typeof payload !== "object" || typeof payload.userId !== "string") {
        throw new Error("Invalid refresh token payload");
    }
    return { userId: payload.userId };
}
