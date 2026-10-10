import { z } from "zod";
export const createEmployeeSchema = z.object({
    employeeNumber: z
        .string()
        .trim()
        .min(1, "Employee number is required"),
    firstName: z
        .string()
        .trim()
        .min(1, "First name is required")
        .max(100),
    lastName: z
        .string()
        .trim()
        .min(1, "Last name is required")
        .max(100),
    middleName: z
        .string()
        .trim()
        .max(100)
        .optional(),
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Please provide a valid email address"),
    phone: z
        .string()
        .trim()
        .max(30)
        .optional(),
    dateOfBirth: z
        .string()
        .datetime()
        .optional(),
    gender: z
        .string()
        .trim()
        .max(50)
        .optional(),
    address: z
        .string()
        .trim()
        .max(500)
        .optional(),
    profilePhoto: z
        .string()
        .trim()
        .url()
        .optional(),
    employmentType: z
        .enum([
        "FULL_TIME",
        "PART_TIME",
        "CONTRACT",
        "INTERN",
        "TEMPORARY",
    ])
        .default("FULL_TIME"),
    employmentStatus: z
        .enum([
        "ACTIVE",
        "PROBATION",
        "ON_LEAVE",
        "SUSPENDED",
        "RESIGNED",
        "TERMINATED",
    ])
        .default("PROBATION"),
    dateJoined: z
        .string()
        .datetime(),
    confirmationDate: z
        .string()
        .datetime()
        .optional(),
    departmentId: z
        .string()
        .uuid()
        .optional(),
    positionId: z
        .string()
        .uuid()
        .optional(),
    managerId: z
        .string()
        .uuid()
        .optional(),
});
export const updateEmployeeSchema = createEmployeeSchema.partial();
export const employeeIdSchema = z.object({
    id: z
        .string()
        .uuid("Invalid employee ID"),
});
