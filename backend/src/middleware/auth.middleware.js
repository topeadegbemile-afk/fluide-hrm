import { verifyAccessToken } from "../utils/jwt.js";
export function authenticate(req, res, next) {
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
        req.user = {
            id: payload.userId,
            email: payload.email,
        };
        next();
    }
    catch {
        res.status(401).json({
            success: false,
            message: "Invalid or expired access token",
            error: "INVALID_ACCESS_TOKEN",
        });
    }
}
