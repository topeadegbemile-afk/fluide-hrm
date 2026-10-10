import { z } from "zod";
export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Please provide a valid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters"),
});
export const refreshTokenSchema = z.object({
    refreshToken: z
        .string()
        .min(1, "Refresh token is required"),
});
