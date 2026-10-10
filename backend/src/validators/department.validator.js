import { z } from "zod";
export const createDepartmentSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Department name must be at least 2 characters")
        .max(100, "Department name must not exceed 100 characters"),
    description: z
        .string()
        .trim()
        .max(500, "Description must not exceed 500 characters")
        .optional(),
    isActive: z.boolean().default(true),
});
export const updateDepartmentSchema = createDepartmentSchema.partial();
export const departmentIdSchema = z.object({
    id: z.string().uuid("Invalid department ID"),
});
