import { z } from "zod";
export const createPositionSchema = z.object({
    title: z
        .string()
        .trim()
        .min(2, "Position title must be at least 2 characters")
        .max(100, "Position title must not exceed 100 characters"),
    description: z
        .string()
        .trim()
        .max(500, "Description must not exceed 500 characters")
        .optional(),
    isActive: z.boolean().default(true),
});
export const updatePositionSchema = createPositionSchema.partial();
