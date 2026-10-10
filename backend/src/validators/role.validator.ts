import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Role name is required").max(100, "Role name is too long"),
  description: z.string().trim().max(500, "Description is too long").optional(),
  permissionIds: z.array(z.string().uuid()).default([]),
});

export const updateRoleSchema = createRoleSchema.partial();

export const assignPermissionSchema = z.object({
  permissionId: z.string().uuid("Permission ID must be a valid UUID"),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AssignPermissionInput = z.infer<typeof assignPermissionSchema>;
