import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please provide a valid email address"),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
  employeeId: z.string().uuid().optional(),
  roleIds: z.array(z.string().uuid()).default([]),
});

export const updateUserSchema = createUserSchema.partial().extend({
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const assignRoleSchema = z.object({
  roleId: z.string().uuid("Role ID must be a valid UUID"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
