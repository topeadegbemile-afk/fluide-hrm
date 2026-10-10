import { z } from "zod";

export const createNotificationSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  employeeId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2, "Title is required").max(150, "Title is too long"),
  message: z.string().trim().min(2, "Message is required").max(2000, "Message is too long"),
  type: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR", "ANNOUNCEMENT"]).default("INFO"),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export const updateNotificationSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(150, "Title is too long").optional(),
  message: z.string().trim().min(2, "Message is required").max(2000, "Message is too long").optional(),
  type: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR", "ANNOUNCEMENT"]).optional(),
  isRead: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;
