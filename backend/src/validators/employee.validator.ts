import { z } from "zod";

export const createEmployeeSchema = z.object({
  officeId: z.string().min(1, "Office is required"),
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
    .email("Please provide a valid email address")
    .or(z.literal(""))
    .optional(),

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
      "HYBRID",
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

  employmentMonthYear: z.string().optional(),

  confirmationDate: z
    .string()
    .datetime()
    .optional(),

  grossSalary: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).optional(),
  lastSalary: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).optional(),
  reviewDate: z.string().datetime().optional(),
  taxId: z.string().trim().max(80).optional(),
  personalEmail: z.string().trim().email().or(z.literal("")).optional(),
  bankName: z.string().trim().max(120).optional(),
  accountName: z.string().trim().max(160).optional(),
  accountNumber: z.string().trim().max(80).optional(),

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

export const updateEmployeeSchema =
  createEmployeeSchema.partial();

export const bulkCreateEmployeesSchema = z.object({
  employees: z.array(z.unknown()).min(1).max(50),
});

export const employeeIdSchema = z.object({
  id: z
    .string()
    .uuid("Invalid employee ID"),
});

export type CreateEmployeeInput =
  z.infer<typeof createEmployeeSchema>;

export type UpdateEmployeeInput =
  z.infer<typeof updateEmployeeSchema>;

export type BulkCreateEmployeesInput = z.infer<
  typeof bulkCreateEmployeesSchema
>;
